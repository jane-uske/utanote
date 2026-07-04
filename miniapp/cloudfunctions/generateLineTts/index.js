// WeChat Cloud Function: generateLineTts
// Ensures one Japanese spoken TTS learning asset exists. Playback and cache hits do
// not consume quota; only a real VOICEVOX synthesis on a cache miss does.

const https = require('https')
const http = require('http')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
const {
  GLOBAL_DAILY_TTS_GENERATE_LIMIT,
  TTS_REQUEST_TIMEOUT_MS,
  ENGINE,
  ENGINE_VERSION,
  DEFAULT_VOICE,
  DEFAULT_SPEED_SCALE,
  validateText,
  normalizeSource,
  normalizeAssetType,
  isFreeSource,
  normalizeSpeedScale,
  normalizePitchScale,
  normalizeIntonationScale,
  normalizeVolumeScale,
  voiceToSpeaker,
  buildCacheKey,
  buildAssetKey,
  cloudPathSegment,
  userLimitForSource,
  userCounterForSource,
  userLimitCodeForSource,
  splitContentForSafety,
  contentSafetyDecision,
} = require('./helpers')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const CONTENT_SECURITY_SCENE = Number(process.env.WX_CONTENT_SECURITY_SCENE || 2)

function todayKey() {
  return new Date().toISOString().slice(0, 10)
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
        try { json = raw ? JSON.parse(raw) : null } catch { /* keep raw */ }
        resolve({ statusCode: res.statusCode, body: raw, json })
      })
    })
    req.on('error', reject)
    req.setTimeout(TTS_REQUEST_TIMEOUT_MS, () => req.destroy(new Error('TTS request timeout')))
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

async function findOne(collection, query) {
  const { data } = await db.collection(collection).where(query).limit(1).get()
  return data && data[0]
}

async function findCache(cacheKey) {
  return findOne('tts_cache', { cacheKey })
}

async function findAsset(assetKey) {
  return findOne('song_tts_assets', { assetKey })
}

async function bindAsset({ assetKey, source, songId, cardId, lineId, assetType, chunkKey, text, audioText, voice, speaker, speedScale, fileID, cacheKey, openid }) {
  const existing = await findAsset(assetKey)
  const data = {
    assetKey,
    source,
    songId,
    cardId,
    lineId,
    assetType,
    chunkKey,
    text,
    audioText,
    voice,
    speaker,
    speedScale,
    fileID,
    cacheKey,
    status: 'ready',
    ownerOpenid: source === 'user_uploaded_song' ? openid : '',
    updatedAt: db.serverDate(),
  }
  if (existing && existing._id) await db.collection('song_tts_assets').doc(existing._id).update({ data })
  else await db.collection('song_tts_assets').add({ data: { ...data, createdAt: db.serverDate() } })
}

async function readUsage(collection, query, field) {
  const existing = await findOne(collection, query)
  return { existing, count: existing ? Number(existing[field] || 0) : 0 }
}

async function checkQuota({ openid, source }) {
  const date = todayKey()
  const global = await readUsage('tts_usage_global_daily', { date }, 'generateCount')
  if (global.count >= GLOBAL_DAILY_TTS_GENERATE_LIMIT) {
    return { ok: false, code: 'GLOBAL_TTS_LIMIT_EXCEEDED', message: '今日语音生成较多，请稍后再试，已生成的内容仍可继续播放。' }
  }
  const counterField = userCounterForSource(source)
  const userLimit = userLimitForSource(source)
  if (counterField && userLimit != null) {
    const usage = await readUsage('tts_usage_daily', { openid, date }, counterField)
    if (usage.count >= userLimit) return { ok: false, code: userLimitCodeForSource(source), message: '今日可生成的学习音频额度已用完，已生成的内容仍可继续播放。' }
  }
  return { ok: true }
}

async function commitUsage({ openid, source }) {
  const date = todayKey()
  const global = await findOne('tts_usage_global_daily', { date })
  if (global && global._id) await db.collection('tts_usage_global_daily').doc(global._id).update({ data: { generateCount: _.inc(1), updatedAt: db.serverDate() } })
  else await db.collection('tts_usage_global_daily').add({ data: { date, generateCount: 1, updatedAt: db.serverDate() } })

  const counterField = userCounterForSource(source)
  if (!counterField) return
  const usage = await findOne('tts_usage_daily', { openid, date })
  if (usage && usage._id) {
    await db.collection('tts_usage_daily').doc(usage._id).update({ data: { [counterField]: _.inc(1), updatedAt: db.serverDate() } })
  } else {
    await db.collection('tts_usage_daily').add({
      data: {
        openid,
        date,
        uploadSongCount: 0,
        generatedAssetCount: counterField === 'generatedAssetCount' ? 1 : 0,
        customTextGenerateCount: counterField === 'customTextGenerateCount' ? 1 : 0,
        updatedAt: db.serverDate(),
      },
    })
  }
}

async function remainingForSource({ openid, source }) {
  const counterField = userCounterForSource(source)
  const limit = userLimitForSource(source)
  if (!counterField || limit == null) return { remainingGenerateCount: null, dailyGenerateLimit: null }
  const usage = await readUsage('tts_usage_daily', { openid, date: todayKey() }, counterField)
  return { remainingGenerateCount: Math.max(0, limit - usage.count), dailyGenerateLimit: limit }
}

function success(payload) {
  return { ok: true, ...payload }
}

async function checkTextContentSafety({ openid, content }) {
  if (!openid) {
    return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE', error: '无法完成内容安全检查，请稍后再试。' }
  }
  const chunks = splitContentForSafety(content)
  if (!chunks.length) return { ok: true }
  if (!cloud.openapi || !cloud.openapi.security || typeof cloud.openapi.security.msgSecCheck !== 'function') {
    return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE', error: '内容安全检查暂不可用，请稍后再试。' }
  }

  for (const part of chunks) {
    let resp
    try {
      resp = await cloud.openapi.security.msgSecCheck({
        version: 2,
        openid,
        scene: CONTENT_SECURITY_SCENE,
        content: part,
      })
    } catch (e) {
      console.warn('content safety check failed:', e)
      return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE', error: '内容安全检查暂不可用，请稍后再试。' }
    }
    const decision = contentSafetyDecision(resp)
    if (!decision.ok) {
      return {
        ok: false,
        code: decision.code,
        error: decision.code === 'CONTENT_RISK'
          ? '朗读文本暂不支持生成语音，请修改后重试。'
          : '内容安全检查暂不可用，请稍后再试。',
      }
    }
  }
  return { ok: true }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_OPENID', error: '无法识别用户，请稍后再试。' }

  const source = normalizeSource(event.source, event.songId)
  if (!source) return { ok: false, code: 'INVALID_SOURCE', error: '无效的语音来源。' }
  const assetType = normalizeAssetType(event.assetType)
  if (!assetType) return { ok: false, code: 'INVALID_ASSET_TYPE', error: '无效的语音资产类型。' }

  const songId = String(event.songId || (source === 'user_custom_text' ? 'custom' : 'unknown-song'))
  const cardId = String(event.cardId || '')
  const lineId = String(event.lineId || (assetType === 'custom_text' ? 'custom-line' : 'unknown-line'))
  const chunkKey = String(event.chunkKey || '')
  const voice = String(event.voice || DEFAULT_VOICE)
  const speedScale = normalizeSpeedScale(event.speedScale == null ? (assetType === 'sentence_slow' ? 0.7 : DEFAULT_SPEED_SCALE) : event.speedScale)
  const pitchScale = normalizePitchScale(event.pitchScale)
  const intonationScale = normalizeIntonationScale(event.intonationScale)
  const volumeScale = normalizeVolumeScale(event.volumeScale)
  const speaker = voiceToSpeaker(voice, event.speaker)

  const textCheck = validateText(event.audioText || event.text)
  if (!textCheck.ok) return { ok: false, code: textCheck.code, error: textCheck.message }
  const audioText = textCheck.text
  const displayText = String(event.text || audioText)

  if (!isFreeSource(source)) {
    const safety = await checkTextContentSafety({ openid: OPENID, content: audioText })
    if (!safety.ok) return safety
  }

  const assetKey = buildAssetKey({ source, songId, cardId, lineId, assetType, chunkKey, voice, speaker, speedScale, audioText })
  const cacheKey = buildCacheKey({ text: audioText, voice, speaker, speedScale, pitchScale, intonationScale })

  try {
    const asset = await findAsset(assetKey)
    if (asset && asset.fileID) {
      const remain = await remainingForSource({ openid: OPENID, source })
      return success({ fileID: asset.fileID, tempURL: await tempURLFor(asset.fileID), cacheKey: asset.cacheKey || cacheKey, cacheHit: true, generated: false, quotaConsumed: false, freeAsset: isFreeSource(source), source, text: displayText, audioText, voice, speaker, speedScale, ...remain })
    }
  } catch (e) { console.warn('asset lookup failed:', e) }

  try {
    const cached = await findCache(cacheKey)
    if (cached && cached.fileID) {
      await bindAsset({ assetKey, source, songId, cardId, lineId, assetType, chunkKey, text: displayText, audioText, voice, speaker, speedScale, fileID: cached.fileID, cacheKey, openid: OPENID })
      const remain = await remainingForSource({ openid: OPENID, source })
      return success({ fileID: cached.fileID, tempURL: await tempURLFor(cached.fileID), cacheKey, cacheHit: true, generated: false, quotaConsumed: false, freeAsset: isFreeSource(source), source, text: displayText, audioText, voice, speaker, speedScale, ...remain })
    }
  } catch (e) { console.warn('cache lookup failed:', e) }

  const quota = await checkQuota({ openid: OPENID, source })
  if (!quota.ok) return { ok: false, code: quota.code, error: quota.message }

  const endpoint = String(process.env.UTANOTE_TTS_ENDPOINT || '').trim().replace(/\/+$/, '')
  const token = String(process.env.UTANOTE_TTS_TOKEN || '').trim()
  if (!endpoint || !token) return { ok: false, code: 'TTS_NOT_CONFIGURED', error: 'TTS 服务未配置。' }

  let tts
  try {
    const res = await httpRequestJSON(endpoint + '/internal/jp-tts', { 'X-UtaNote-Token': token }, { text: audioText, speaker, voice, speedScale, pitchScale, intonationScale, volumeScale })
    if (res.statusCode < 200 || res.statusCode >= 300 || !res.json || !res.json.audioBase64) {
      const code = (res.json && (res.json.code || res.json.error)) || (res.statusCode === 429 ? 'TTS_BUSY' : `TTS_HTTP_${res.statusCode}`)
      return { ok: false, code, error: code === 'TTS_BUSY' ? '语音生成繁忙，请稍后再试。' : '语音生成失败，请稍后再试。' }
    }
    tts = res.json
  } catch (e) {
    console.warn('tts service failed:', e)
    return { ok: false, code: 'TTS_ENGINE_FAILED', error: '语音生成失败，请稍后再试。' }
  }

  const ext = tts.ext === 'm4a' ? 'm4a' : 'mp3'
  const audio = Buffer.from(String(tts.audioBase64 || ''), 'base64')
  if (!audio.length) return { ok: false, code: 'EMPTY_AUDIO', error: '语音生成失败，请稍后再试。' }

  const owner = cloudPathSegment(source === 'user_uploaded_song' ? OPENID : source, 'source')
  const scope = cloudPathSegment(songId || cardId || 'custom', 'scope')
  const cloudPath = `tts/${owner}/${scope}/${cacheKey}.${ext}`
  let fileID
  try {
    const uploaded = await cloud.uploadFile({ cloudPath, fileContent: audio })
    fileID = uploaded.fileID
    await db.collection('tts_cache').add({
      data: {
        cacheKey,
        normalizedText: audioText,
        originalText: displayText,
        voice,
        speaker,
        speedScale,
        pitchScale,
        intonationScale,
        engine: tts.engine || ENGINE,
        engineVersion: ENGINE_VERSION,
        fileID,
        cloudPath,
        contentType: tts.contentType || 'audio/mpeg',
        ext,
        durationMs: tts.durationMs || null,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
    await bindAsset({ assetKey, source, songId, cardId, lineId, assetType, chunkKey, text: displayText, audioText, voice, speaker, speedScale, fileID, cacheKey, openid: OPENID })
    await commitUsage({ openid: OPENID, source })
  } catch (e) {
    console.warn('upload/cache write failed:', e)
    return { ok: false, code: 'TTS_UPLOAD_FAILED', error: '语音保存失败，请稍后再试。' }
  }

  const remain = await remainingForSource({ openid: OPENID, source })
  return success({ fileID, tempURL: await tempURLFor(fileID), cacheKey, cacheHit: false, generated: true, quotaConsumed: !isFreeSource(source), freeAsset: isFreeSource(source), source, text: displayText, audioText, voice, speaker, speedScale, ...remain })
}
