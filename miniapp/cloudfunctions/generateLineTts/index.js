// WeChat Cloud Function: generateLineTts
// Ensures a Japanese spoken-TTS learning asset through a private local Mac
// service exposed by cloudflared. Playback/cache hits do not consume quota.

const https = require('https')
const http = require('http')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
const {
  DAILY_GENERATE_LIMIT,
  ENGINE,
  ENGINE_VERSION,
  DEFAULT_VOICE,
  DEFAULT_SPEED_SCALE,
  validateText,
  normalizeSpeedScale,
  voiceToSpeaker,
  buildCacheKey,
  cloudPathSegment,
} = require('./helpers')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const HTTP_TIMEOUT = Number(process.env.TTS_REQUEST_TIMEOUT_MS || 15000)
const DAILY_CUSTOM_TEXT_GENERATE_LIMIT = Number(process.env.DAILY_CUSTOM_TEXT_GENERATE_LIMIT || 100)
const GLOBAL_DAILY_TTS_GENERATE_LIMIT = Number(process.env.GLOBAL_DAILY_TTS_GENERATE_LIMIT || 3000)
const SOURCES = new Set(['platform_card', 'whitelist_song', 'user_uploaded_song', 'user_custom_text'])
const FREE_SOURCES = new Set(['platform_card', 'whitelist_song'])

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeSource(source, songId) {
  const fallback = String(songId || '') === 'demo' ? 'platform_card' : 'user_uploaded_song'
  const value = String(source || fallback).trim()
  return SOURCES.has(value) ? value : ''
}

function quotaFieldFor(source) {
  if (source === 'user_custom_text') return 'customTextGenerateCount'
  if (source === 'user_uploaded_song') return 'generatedAssetCount'
  return ''
}

function quotaLimitFor(source) {
  if (source === 'user_custom_text') return DAILY_CUSTOM_TEXT_GENERATE_LIMIT
  if (source === 'user_uploaded_song') return DAILY_GENERATE_LIMIT
  return null
}

function quotaCodeFor(source) {
  if (source === 'user_custom_text') return 'DAILY_CUSTOM_TEXT_LIMIT_EXCEEDED'
  if (source === 'user_uploaded_song') return 'DAILY_USER_ASSET_LIMIT_EXCEEDED'
  return 'DAILY_TTS_LIMIT_EXCEEDED'
}

function assetKeyFor({ source, songId, lineId, assetType, chunkKey, text, voice, speedScale }) {
  if (source === 'user_custom_text') return ''
  const raw = [source, songId, lineId, assetType || 'sentence_normal', chunkKey || '', text, voice, speedScale].join('\n')
  let hash = 5381
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i)
    hash >>>= 0
  }
  return hash.toString(16)
}

function httpRequestJSON(urlStr, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const body = JSON.stringify(payload)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(parsed, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = raw ? JSON.parse(raw) : null } catch { /* keep raw for diagnostics */ }
        resolve({ statusCode: res.statusCode, body: raw, json })
      })
    })
    req.on('error', reject)
    req.setTimeout(HTTP_TIMEOUT, () => req.destroy(new Error('TTS request timeout')))
    req.write(body)
    req.end()
  })
}

async function tempURLFor(fileID) {
  try {
    const r = await cloud.getTempFileURL({ fileList: [fileID] })
    const item = r.fileList && r.fileList[0]
    return item && item.tempFileURL ? item.tempFileURL : ''
  } catch (e) {
    console.warn('get temp url failed:', e)
    return ''
  }
}

async function findOne(collection, where) {
  const { data } = await db.collection(collection).where(where).limit(1).get()
  return data && data[0]
}

async function findCache(cacheKey) {
  return findOne('tts_cache', { cacheKey })
}

async function findAsset(assetKey) {
  if (!assetKey) return null
  return findOne('song_tts_assets', { assetKey })
}

async function bindAsset(assetKey, data) {
  if (!assetKey) return
  const existing = await findAsset(assetKey)
  const payload = { ...data, assetKey, status: 'ready', updatedAt: db.serverDate() }
  if (existing) await db.collection('song_tts_assets').doc(existing._id).update({ data: payload })
  else await db.collection('song_tts_assets').add({ data: { ...payload, createdAt: db.serverDate() } })
}

async function readUsage(openid) {
  const date = todayKey()
  const doc = await findOne('tts_usage_daily', { openid, date })
  return { date, doc, generatedAssetCount: Number((doc && (doc.generatedAssetCount || doc.generateCount)) || 0), customTextGenerateCount: Number((doc && doc.customTextGenerateCount) || 0) }
}

async function incrementUsage(openid, source) {
  const field = quotaFieldFor(source)
  if (!field) return
  const date = todayKey()
  const doc = await findOne('tts_usage_daily', { openid, date })
  if (doc) await db.collection('tts_usage_daily').doc(doc._id).update({ data: { [field]: _.inc(1), updatedAt: db.serverDate() } })
  else await db.collection('tts_usage_daily').add({ data: { openid, date, uploadSongCount: 0, generatedAssetCount: field === 'generatedAssetCount' ? 1 : 0, customTextGenerateCount: field === 'customTextGenerateCount' ? 1 : 0, updatedAt: db.serverDate() } })
}

async function checkGlobalQuota() {
  const date = todayKey()
  const doc = await findOne('tts_usage_global_daily', { date })
  const count = Number((doc && doc.generateCount) || 0)
  if (count >= GLOBAL_DAILY_TTS_GENERATE_LIMIT) return { ok: false, code: 'GLOBAL_TTS_LIMIT_EXCEEDED', message: '今日语音生成较多，请稍后再试，已生成的内容仍可继续播放。' }
  return { ok: true, doc, date }
}

async function incrementGlobalQuota(globalQuota) {
  if (globalQuota && globalQuota.doc) await db.collection('tts_usage_global_daily').doc(globalQuota.doc._id).update({ data: { generateCount: _.inc(1), updatedAt: db.serverDate() } })
  else await db.collection('tts_usage_global_daily').add({ data: { date: todayKey(), generateCount: 1, updatedAt: db.serverDate() } })
}

function error(code, message) {
  return { ok: false, code, error: message }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const songId = String(event.songId || 'unknown-song')
  const lineId = String(event.lineId || 'unknown-line')
  const source = normalizeSource(event.source, songId)
  if (!source) return error('INVALID_SOURCE', '无效的音频来源。')

  const textCheck = validateText(event.audioText || event.text)
  if (!textCheck.ok) return error(textCheck.code, textCheck.message)

  const assetType = String(event.assetType || 'sentence_normal')
  const chunkKey = String(event.chunkKey || '')
  const voice = String(event.voice || DEFAULT_VOICE)
  const speedScale = normalizeSpeedScale(event.speedScale == null ? DEFAULT_SPEED_SCALE : event.speedScale)
  const cacheKey = buildCacheKey({ text: textCheck.text, voice, speedScale })
  const assetKey = assetKeyFor({ source, songId, lineId, assetType, chunkKey, text: textCheck.text, voice, speedScale })
  const limit = quotaLimitFor(source)
  const field = quotaFieldFor(source)

  try {
    const asset = await findAsset(assetKey)
    if (asset && asset.fileID) {
      return { ok: true, fileID: asset.fileID, tempURL: await tempURLFor(asset.fileID), cacheKey: asset.cacheKey || cacheKey, cacheHit: true, generated: false, quotaConsumed: false, freeAsset: FREE_SOURCES.has(source), source, remainingGenerateCount: null, dailyGenerateLimit: limit, text: event.text || textCheck.text, audioText: asset.audioText || textCheck.text, voice, speedScale }
    }
  } catch (e) { console.warn('asset lookup failed:', e) }

  try {
    const cached = await findCache(cacheKey)
    if (cached && cached.fileID) {
      await bindAsset(assetKey, { source, songId, lineId, assetType, chunkKey, displayText: event.text || textCheck.text, audioText: textCheck.text, voice, speedScale, cacheKey, fileID: cached.fileID, createdBy: OPENID || '' })
      return { ok: true, fileID: cached.fileID, tempURL: await tempURLFor(cached.fileID), cacheKey, cacheHit: true, generated: false, quotaConsumed: false, freeAsset: FREE_SOURCES.has(source), source, remainingGenerateCount: null, dailyGenerateLimit: limit, text: event.text || textCheck.text, audioText: textCheck.text, voice, speedScale }
    }
  } catch (e) { console.warn('cache lookup failed:', e) }

  if (!OPENID) return error('NO_OPENID', '无法识别用户，请稍后再试。')

  let usage
  let globalQuota
  try {
    usage = await readUsage(OPENID)
    if (field && Number(usage[field] || 0) >= limit) return error(quotaCodeFor(source), '今日可生成的学习音频额度已用完，已生成的内容仍可继续播放。')
    globalQuota = await checkGlobalQuota()
    if (!globalQuota.ok) return error(globalQuota.code, globalQuota.message)
  } catch (e) {
    console.warn('rate limit failed:', e)
    return error('RATE_LIMIT_FAILED', '限流检查失败，请稍后再试。')
  }

  const endpoint = String(process.env.UTANOTE_TTS_ENDPOINT || '').trim().replace(/\/+$/, '')
  const token = String(process.env.UTANOTE_TTS_TOKEN || '').trim()
  if (!endpoint || !token) return error('TTS_NOT_CONFIGURED', 'TTS 服务未配置。')

  let tts
  try {
    const res = await httpRequestJSON(endpoint + '/internal/jp-tts', { 'X-UtaNote-Token': token }, { text: textCheck.text, speaker: voiceToSpeaker(voice), speedScale })
    if (res.statusCode === 429) return error('TTS_BUSY', '语音生成繁忙，请稍后再试。')
    if (res.statusCode < 200 || res.statusCode >= 300 || !res.json || !res.json.audioBase64) throw new Error(((res.json && (res.json.code || res.json.error)) || `TTS_HTTP_${res.statusCode}`) + ': ' + (res.body || '').slice(0, 300))
    tts = res.json
  } catch (e) {
    console.warn('tts service failed:', e)
    return error('TTS_ENGINE_FAILED', '语音生成失败，请稍后再试。')
  }

  const ext = tts.ext === 'm4a' ? 'm4a' : 'mp3'
  const audio = Buffer.from(String(tts.audioBase64 || ''), 'base64')
  if (!audio.length) return error('EMPTY_AUDIO', '语音生成失败，请稍后再试。')

  const cloudPath = `tts/${cloudPathSegment(source, 'source')}/${cloudPathSegment(songId, 'song')}/${cacheKey}.${ext}`
  let fileID
  try {
    const uploaded = await cloud.uploadFile({ cloudPath, fileContent: audio })
    fileID = uploaded.fileID
    await db.collection('tts_cache').add({ data: { cacheKey, normalizedText: textCheck.text, originalText: event.text || textCheck.text, voice, speedScale, engine: tts.engine || ENGINE, engineVersion: tts.engineVersion || ENGINE_VERSION, speaker: tts.speaker, fileID, cloudPath, durationMs: tts.durationMs || null, createdAt: db.serverDate(), updatedAt: db.serverDate(), createdBy: OPENID } })
    await bindAsset(assetKey, { source, songId, lineId, assetType, chunkKey, displayText: event.text || textCheck.text, audioText: textCheck.text, voice, speedScale, cacheKey, fileID, cloudPath, createdBy: OPENID })
    await incrementGlobalQuota(globalQuota)
    await incrementUsage(OPENID, source)
  } catch (e) {
    console.warn('upload/cache write failed:', e)
    return error('TTS_UPLOAD_FAILED', '语音保存失败，请稍后再试。')
  }

  const usedBefore = field ? Number(usage[field] || 0) : 0
  return { ok: true, fileID, tempURL: await tempURLFor(fileID), cacheKey, cacheHit: false, generated: true, quotaConsumed: !!field, freeAsset: FREE_SOURCES.has(source), source, remainingGenerateCount: field && limit != null ? Math.max(0, limit - usedBefore - 1) : null, dailyGenerateLimit: limit, text: event.text || textCheck.text, audioText: textCheck.text, voice, speedScale }
}
