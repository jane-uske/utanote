const http = require('http')
const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { normalizeRequest } = require('./helpers')

const PORT = Number(process.env.PORT || process.env.UTANOTE_TTS_PORT || 8787)
const TOKEN = String(process.env.UTANOTE_TTS_TOKEN || '').trim()
const VOICEVOX_BASE = String(process.env.VOICEVOX_ENGINE_URL || 'http://127.0.0.1:50021').replace(/\/+$/, '')
const MAX_BODY_BYTES = 16 * 1024

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('request body too large'), { code: 'BODY_TOO_LARGE' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (e) {
        reject(Object.assign(e, { code: 'BAD_JSON' }))
      }
    })
    req.on('error', reject)
  })
}

async function fetchArrayBuffer(url, options) {
  const res = await fetch(url, options)
  const raw = Buffer.from(await res.arrayBuffer())
  if (!res.ok) {
    throw Object.assign(new Error(raw.toString('utf8').slice(0, 500) || `HTTP ${res.status}`), {
      status: res.status,
    })
  }
  return raw
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options)
  const raw = await res.text()
  if (!res.ok) {
    throw Object.assign(new Error(raw.slice(0, 500) || `HTTP ${res.status}`), { status: res.status })
  }
  return JSON.parse(raw)
}

async function synthesizeWav(params) {
  const queryURL = new URL(VOICEVOX_BASE + '/audio_query')
  queryURL.searchParams.set('text', params.text)
  queryURL.searchParams.set('speaker', String(params.speaker))

  const audioQuery = await fetchJSON(queryURL, { method: 'POST' })
  audioQuery.speedScale = params.speedScale
  audioQuery.pitchScale = params.pitchScale
  audioQuery.intonationScale = params.intonationScale

  const synthesisURL = new URL(VOICEVOX_BASE + '/synthesis')
  synthesisURL.searchParams.set('speaker', String(params.speaker))
  return fetchArrayBuffer(synthesisURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audioQuery),
  })
}

function runFFmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-codec:a', 'libmp3lame',
      '-b:a', '96k',
      outputPath,
    ])
    let stderr = ''
    ff.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`))
    })
  })
}

function probeDurationMs(inputPath) {
  return new Promise((resolve) => {
    const ff = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ])
    let stdout = ''
    ff.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    ff.on('error', () => resolve(null))
    ff.on('close', () => {
      const n = Number(stdout.trim())
      resolve(Number.isFinite(n) ? Math.round(n * 1000) : null)
    })
  })
}

async function wavToMp3(wav) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'utanote-tts-'))
  const wavPath = path.join(dir, 'input.wav')
  const mp3Path = path.join(dir, 'output.mp3')
  try {
    await fs.writeFile(wavPath, wav)
    await runFFmpeg(wavPath, mp3Path)
    const [mp3, durationMs] = await Promise.all([
      fs.readFile(mp3Path),
      probeDurationMs(mp3Path),
    ])
    return { mp3, durationMs }
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

async function handleTts(req, res) {
  if (!TOKEN) {
    sendJSON(res, 500, { ok: false, code: 'TOKEN_NOT_CONFIGURED', error: 'UTANOTE_TTS_TOKEN is not configured' })
    return
  }
  if (req.headers['x-utanote-token'] !== TOKEN) {
    sendJSON(res, 401, { ok: false, code: 'UNAUTHORIZED', error: 'invalid token' })
    return
  }

  let body
  try {
    body = await readJSON(req)
  } catch (e) {
    const code = e.code === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'BAD_JSON'
    sendJSON(res, 400, { ok: false, code, error: e.message })
    return
  }

  const params = normalizeRequest(body)
  if (!params.ok) {
    sendJSON(res, params.status, { ok: false, code: params.code, error: params.message })
    return
  }

  try {
    const wav = await synthesizeWav(params)
    const { mp3, durationMs } = await wavToMp3(wav)
    sendJSON(res, 200, {
      ok: true,
      requestId: randomUUID(),
      contentType: 'audio/mpeg',
      ext: 'mp3',
      audioBase64: mp3.toString('base64'),
      durationMs,
      engine: 'voicevox',
      speaker: params.speaker,
    })
  } catch (e) {
    console.error('[jp-tts]', e)
    const status = e.status && e.status >= 400 && e.status < 600 ? 502 : 500
    sendJSON(res, status, {
      ok: false,
      code: e.status ? 'VOICEVOX_FAILED' : 'TTS_FAILED',
      error: e.message || String(e),
    })
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJSON(res, 200, { ok: true, engine: 'voicevox', voicevoxBase: VOICEVOX_BASE })
    return
  }
  if (req.method === 'POST' && url.pathname === '/internal/jp-tts') {
    handleTts(req, res)
    return
  }
  sendJSON(res, 404, { ok: false, code: 'NOT_FOUND', error: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`UtaNote local TTS server listening on http://127.0.0.1:${PORT}`)
  console.log(`VOICEVOX Engine: ${VOICEVOX_BASE}`)
})
