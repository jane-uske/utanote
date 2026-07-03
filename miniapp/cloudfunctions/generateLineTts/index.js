// WeChat Cloud Function: generateLineTts
// Generates cached single-line Japanese spoken TTS through a private local Mac
// service exposed by cloudflared. The mini-program never sees that endpoint or token.

const https = require('https')
const http = require('http')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
const {
  DAILY_GENERATE_LIMIT,
  ENGINE,
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

const HTTP_TIMEOUT = 15000

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

async function findCache(cacheKey) {
  const { data } = await db.collection('tts_cache').where({ cacheKey }).limit(1).get()
  return data && data[0]
}

async function checkAndCountUsage(openid) {
  const date = todayKey()
  const { data } = await db.collection('tts_usage_daily').where({ openid, date }).limit(1).get()
  const existing = data && data[0]
  const count = existing ? Number(existing.generateCount || 0) : 0
  if (count >= DAILY_GENERATE_LIMIT) {
    return { ok: false, code: 'DAILY_LIMIT', message: '今日生成次数已用完。' }
  }
  if (existing) {
    await db.collection('tts_usage_daily').doc(existing._id).update({
      data: { generateCount: _.inc(1), updatedAt: db.serverDate() },
    })
  } else {
    await db.collection('tts_usage_daily').add({
      data: { openid, date, generateCount: 1, updatedAt: db.serverDate() },
    })
  }
  return { ok: true }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const textCheck = validateText(event.text)
  if (!textCheck.ok) return { ok: false, code: textCheck.code, error: textCheck.message }

  const songId = String(event.songId || 'unknown-song')
  const lineId = String(event.lineId || 'unknown-line')
  const voice = String(event.voice || DEFAULT_VOICE)
  const speedScale = normalizeSpeedScale(event.speedScale == null ? DEFAULT_SPEED_SCALE : event.speedScale)
  const cacheKey = buildCacheKey({ songId, lineId, text: textCheck.text, voice, speedScale })

  try {
    const cached = await findCache(cacheKey)
    if (cached && cached.fileID) {
      return {
        ok: true,
        fileID: cached.fileID,
        tempURL: await tempURLFor(cached.fileID),
        cacheHit: true,
        text: textCheck.text,
        voice,
        speedScale,
      }
    }
  } catch (e) {
    console.warn('cache lookup failed:', e)
  }

  if (!OPENID) return { ok: false, code: 'NO_OPENID', error: '无法识别用户，请稍后再试。' }

  try {
    const quota = await checkAndCountUsage(OPENID)
    if (!quota.ok) return { ok: false, code: quota.code, error: quota.message }
  } catch (e) {
    console.warn('rate limit failed:', e)
    return { ok: false, code: 'RATE_LIMIT_FAILED', error: '限流检查失败，请稍后再试。' }
  }

  const endpoint = String(process.env.UTANOTE_TTS_ENDPOINT || '').trim().replace(/\/+$/, '')
  const token = String(process.env.UTANOTE_TTS_TOKEN || '').trim()
  if (!endpoint || !token) {
    return { ok: false, code: 'TTS_NOT_CONFIGURED', error: 'TTS 服务未配置。' }
  }

  let tts
  try {
    const res = await httpRequestJSON(endpoint + '/internal/jp-tts', {
      'X-UtaNote-Token': token,
    }, {
      text: textCheck.text,
      speaker: voiceToSpeaker(voice),
      speedScale,
    })
    if (res.statusCode < 200 || res.statusCode >= 300 || !res.json || !res.json.audioBase64) {
      const code = (res.json && res.json.code) || `TTS_HTTP_${res.statusCode}`
      throw new Error(`${code}: ${(res.body || '').slice(0, 300)}`)
    }
    tts = res.json
  } catch (e) {
    console.warn('tts service failed:', e)
    return { ok: false, code: 'TTS_SERVICE_FAILED', error: '语音生成失败，请稍后再试。' }
  }

  const ext = tts.ext === 'm4a' ? 'm4a' : 'mp3'
  const audio = Buffer.from(String(tts.audioBase64 || ''), 'base64')
  if (!audio.length) return { ok: false, code: 'EMPTY_AUDIO', error: '语音生成失败，请稍后再试。' }

  const cloudPath = `tts/${cloudPathSegment(songId, 'song')}/${cloudPathSegment(lineId, 'line')}/${cacheKey}.${ext}`
  let fileID
  try {
    const uploaded = await cloud.uploadFile({ cloudPath, fileContent: audio })
    fileID = uploaded.fileID
    await db.collection('tts_cache').add({
      data: {
        cacheKey,
        songId,
        lineId,
        text: textCheck.text,
        voice,
        speedScale,
        engine: tts.engine || ENGINE,
        speaker: tts.speaker,
        fileID,
        durationMs: tts.durationMs || null,
        createdAt: db.serverDate(),
        createdBy: OPENID,
      },
    })
  } catch (e) {
    console.warn('upload/cache write failed:', e)
    return { ok: false, code: 'CLOUD_UPLOAD_FAILED', error: '语音保存失败，请稍后再试。' }
  }

  return {
    ok: true,
    fileID,
    tempURL: await tempURLFor(fileID),
    cacheHit: false,
    text: textCheck.text,
    voice,
    speedScale,
  }
}
