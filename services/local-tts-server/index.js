const http = require('http')
const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')
const { URL } = require('url')

const PORT = Number(process.env.PORT || 8787)
const TOKEN = String(process.env.UTANOTE_TTS_TOKEN || '')
const VOICEVOX_ENDPOINT = String(process.env.VOICEVOX_ENDPOINT || 'http://127.0.0.1:50021').replace(/\/+$/, '')
const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_DEFAULT_SPEAKER || 16)
const MAX_TTS_CONCURRENCY = Math.max(1, Number(process.env.MAX_TTS_CONCURRENCY || 1))
const TEXT_MAX_LENGTH = Math.max(1, Number(process.env.TEXT_MAX_LENGTH || 120))
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.VOICEVOX_TIMEOUT_MS || 30000))

let activeJobs = 0

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

function readBody(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) { reject(new Error('REQUEST_TOO_LARGE')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function parseJsonBody(req) {
  const raw = await readBody(req)
  return raw ? JSON.parse(raw) : {}
}

function requestBuffer(urlStr, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(parsed, { method, headers }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`HTTP_${res.statusCode}: ${buf.toString('utf8').slice(0, 500)}`)
          err.statusCode = res.statusCode
          reject(err)
          return
        }
        resolve(buf)
      })
    })
    req.on('error', reject)
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('VOICEVOX_TIMEOUT')))
    if (body) req.write(body)
    req.end()
  })
}

async function requestJson(urlStr, options) {
  const buf = await requestBuffer(urlStr, options)
  return JSON.parse(buf.toString('utf8'))
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value == null ? fallback : value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100))
}

function validatePayload(payload) {
  const text = String(payload.text || '').trim().replace(/\s+/g, ' ')
  if (!text) return { ok: false, code: 'TEXT_EMPTY', message: '朗读文本不能为空。' }
  if (text.length > TEXT_MAX_LENGTH) return { ok: false, code: 'TEXT_TOO_LONG', message: `文本太长，最多 ${TEXT_MAX_LENGTH} 字。` }
  const explicitSpeaker = Number(payload.speaker)
  return {
    ok: true,
    text,
    speaker: Number.isFinite(explicitSpeaker) && explicitSpeaker >= 0 ? explicitSpeaker : DEFAULT_SPEAKER,
    speedScale: clampNumber(payload.speedScale, 0.9, 0.5, 1.5),
    pitchScale: clampNumber(payload.pitchScale, 0, -0.15, 0.15),
    intonationScale: clampNumber(payload.intonationScale, 1, 0, 2),
    volumeScale: clampNumber(payload.volumeScale, 1, 0, 2),
  }
}

function execFilePromise(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) { error.stderr = stderr; reject(error); return }
      resolve({ stdout, stderr })
    })
  })
}

function wavDurationMs(buf) {
  try {
    if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') return null
    const byteRate = buf.readUInt32LE(28)
    const dataIndex = buf.indexOf(Buffer.from('data'))
    if (!byteRate || dataIndex < 0 || dataIndex + 8 > buf.length) return null
    const dataSize = buf.readUInt32LE(dataIndex + 4)
    return Math.round((dataSize / byteRate) * 1000)
  } catch { return null }
}

async function synthesize(payload) {
  const p = validatePayload(payload)
  if (!p.ok) return { status: 400, body: p }

  const queryURL = `${VOICEVOX_ENDPOINT}/audio_query?text=${encodeURIComponent(p.text)}&speaker=${encodeURIComponent(p.speaker)}`
  const query = await requestJson(queryURL, { method: 'POST' })
  query.speedScale = p.speedScale
  query.pitchScale = p.pitchScale
  query.intonationScale = p.intonationScale
  query.volumeScale = p.volumeScale

  const wav = await requestBuffer(`${VOICEVOX_ENDPOINT}/synthesis?speaker=${encodeURIComponent(p.speaker)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  const durationMs = wavDurationMs(wav)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'utanote-tts-'))
  const wavPath = path.join(dir, 'voice.wav')
  const mp3Path = path.join(dir, 'voice.mp3')
  try {
    fs.writeFileSync(wavPath, wav)
    await execFilePromise(FFMPEG_PATH, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '96k', mp3Path])
    const mp3 = fs.readFileSync(mp3Path)
    return { status: 200, body: { ok: true, contentType: 'audio/mpeg', ext: 'mp3', audioBase64: mp3.toString('base64'), engine: 'voicevox', speaker: p.speaker, durationMs } }
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

async function voicevoxHealth() {
  try {
    const version = await requestBuffer(`${VOICEVOX_ENDPOINT}/version`, { method: 'GET' })
    return { reachable: true, version: version.toString('utf8').replace(/^"|"$/g, '') }
  } catch (e) { return { reachable: false, error: e.message } }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (req.method === 'GET' && url.pathname === '/health') {
      const health = await voicevoxHealth()
      return sendJson(res, 200, { ok: true, engine: 'voicevox', voicevoxReachable: health.reachable, voicevoxVersion: health.version || '', voicevoxError: health.error || '', activeJobs, maxConcurrency: MAX_TTS_CONCURRENCY })
    }
    if (req.method !== 'POST' || url.pathname !== '/internal/jp-tts') return sendJson(res, 404, { ok: false, code: 'NOT_FOUND' })
    if (!TOKEN || req.headers['x-utanote-token'] !== TOKEN) return sendJson(res, 401, { ok: false, code: 'UNAUTHORIZED', error: 'UNAUTHORIZED' })
    if (activeJobs >= MAX_TTS_CONCURRENCY) return sendJson(res, 429, { ok: false, code: 'TTS_BUSY', error: 'TTS_BUSY', message: '语音生成繁忙，请稍后再试' })

    const payload = await parseJsonBody(req)
    activeJobs += 1
    try {
      const result = await synthesize(payload)
      return sendJson(res, result.status, result.body)
    } catch (e) {
      console.error('[local-tts] synthesize failed:', e && e.stderr ? e.stderr : e)
      return sendJson(res, 500, { ok: false, code: 'VOICEVOX_ENGINE_FAILED', error: 'VOICEVOX_ENGINE_FAILED', message: '语音生成失败' })
    } finally { activeJobs = Math.max(0, activeJobs - 1) }
  } catch (e) {
    console.error('[local-tts] request failed:', e)
    return sendJson(res, 400, { ok: false, code: e.message === 'REQUEST_TOO_LARGE' ? 'REQUEST_TOO_LARGE' : 'BAD_REQUEST', error: e.message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-tts] listening on http://127.0.0.1:${PORT}`)
  console.log(`[local-tts] voicevox endpoint: ${VOICEVOX_ENDPOINT}`)
})
