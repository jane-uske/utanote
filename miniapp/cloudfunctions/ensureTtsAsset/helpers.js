const crypto = require('crypto')

// ── Configuration (env vars with defaults) ────────────────────────
const MAX_TEXT_CHARS = Number(process.env.TEXT_MAX_LENGTH || 120)
const DAILY_UPLOAD_SONG_LIMIT = Number(process.env.DAILY_UPLOAD_SONG_LIMIT || 1)
const MAX_LINES_PER_USER_SONG = Number(process.env.MAX_LINES_PER_USER_SONG || 60)
const DAILY_USER_ASSET_GENERATE_LIMIT = Number(process.env.DAILY_USER_ASSET_GENERATE_LIMIT || 300)
const DAILY_CUSTOM_TEXT_GENERATE_LIMIT = Number(process.env.DAILY_CUSTOM_TEXT_GENERATE_LIMIT || 100)
const GLOBAL_DAILY_TTS_GENERATE_LIMIT = Number(process.env.GLOBAL_DAILY_TTS_GENERATE_LIMIT || 3000)
const TTS_REQUEST_TIMEOUT_MS = Number(process.env.TTS_REQUEST_TIMEOUT_MS || 15000)

const ENGINE = 'voicevox'
const ENGINE_VERSION = String(process.env.VOICEVOX_ENGINE_VERSION || 'voicevox-v0.1.0')
const DEFAULT_VOICE = 'voicevox_sora_normal'
const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_DEFAULT_SPEAKER || 2)
const DEFAULT_SPEED_SCALE = 0.9
const DEFAULT_SLOW_SPEED_SCALE = 0.65

const VOICE_SPEAKER_MAP = {
  voicevox_metan_normal: 2,
  voicevoz_zundamon_normal: 3,
  voicevox_tsumugi_normal: 8,
  voicevox_sora_normal: 16,
  voicevox_no7_reading: 31,
  voicevox_default_female: 2,
  [DEFAULT_VOICE]: DEFAULT_SPEAKER,
}

const VALID_SOURCES = ['platform_card', 'whitelist_song', 'user_uploaded_song', 'user_custom_text']
const VALID_ASSET_TYPES = ['sentence_normal', 'sentence_slow', 'chunk', 'custom_text']

// Japanese orthography normalization
const JP_ORTHOGRAPHY_REPLACEMENTS = {
  '风': '風',
}

// ── Helpers ──────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeText(text) {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ')
  return normalized.replace(/[风]/g, (char) => JP_ORTHOGRAPHY_REPLACEMENTS[char] || char)
}

function validateText(text) {
  const normalized = normalizeText(text)
  if (!normalized) return { ok: false, code: 'TEXT_EMPTY', message: '朗读文本不能为空。' }
  if (normalized.length > MAX_TEXT_CHARS) {
    return { ok: false, code: 'TEXT_TOO_LONG', message: `这句歌词太长了，最多支持 ${MAX_TEXT_CHARS} 字。` }
  }
  return { ok: true, text: normalized }
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value == null ? fallback : value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100))
}

function normalizeSpeedScale(value, fallback) {
  return clampNumber(value, fallback || DEFAULT_SPEED_SCALE, 0.5, 2.0)
}

function voiceToSpeaker(voice) {
  return VOICE_SPEAKER_MAP[voice] || DEFAULT_SPEAKER
}

/**
 * Global cache key — no openid, no songId.
 * Same text + voice + speaker + speed + pitch + intonation + engine + version
 * → same audio file for the whole platform.
 */
function buildCacheKey({ normalizedText, voice, speaker, speedScale, pitchScale, intonationScale }) {
  const source = [
    normalizedText,
    String(voice || DEFAULT_VOICE),
    String(speaker || DEFAULT_SPEAKER),
    String(clampNumber(speedScale, DEFAULT_SPEED_SCALE, 0.5, 2.0)),
    String(clampNumber(pitchScale, 0, -0.15, 0.15)),
    String(clampNumber(intonationScale, 1, 0, 2)),
    ENGINE,
    ENGINE_VERSION,
  ].join('\n')
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 32)
}

function buildCloudPath({ source, songId, cardId, cacheKey }) {
  const segment = songId || cardId || 'custom'
  const safe = String(segment).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'custom'
  return `tts/${source}/${safe}/${cacheKey}.mp3`
}

function httpRequestJSON(urlStr, headers, payload, timeoutMs) {
  const https = require('https')
  const http = require('http')
  const { URL } = require('url')
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
    req.setTimeout(timeoutMs || TTS_REQUEST_TIMEOUT_MS, () => req.destroy(new Error('TTS request timeout')))
    req.write(body)
    req.end()
  })
}

async function getTempURL(fileID, cloud) {
  try {
    const r = await cloud.getTempFileURL({ fileList: [fileID] })
    const item = r.fileList && r.fileList[0]
    return item && item.tempFileURL ? item.tempFileURL : ''
  } catch {
    return ''
  }
}

// ── Asset path helpers for song_tts_assets ───────────────────────

/**
 * Build the dot-path to an asset within a song_tts_assets document.
 * Returns e.g. "lines.0.sentenceNormal" or "lines.2.chunks.1"
 */
function assetPath(lineIndex, assetType, chunkIndex) {
  if (assetType === 'sentence_normal') return `lines.${lineIndex}.sentenceNormal`
  if (assetType === 'sentence_slow') return `lines.${lineIndex}.sentenceSlow`
  if (assetType === 'chunk' && chunkIndex != null) return `lines.${lineIndex}.chunks.${chunkIndex}`
  return null
}

/**
 * Find the matching asset in a song_tts_assets document.
 */
function findAssetInDoc(doc, lineId, assetType, chunkKey) {
  if (!doc || !doc.lines) return null
  const lineIndex = doc.lines.findIndex((l) => l.lineId === lineId)
  if (lineIndex < 0) return null

  if (assetType === 'sentence_normal') return { lineIndex, asset: doc.lines[lineIndex].sentenceNormal }
  if (assetType === 'sentence_slow') return { lineIndex, asset: doc.lines[lineIndex].sentenceSlow }
  if (assetType === 'chunk' && chunkKey != null) {
    const chunks = doc.lines[lineIndex].chunks || []
    const chunkIndex = chunks.findIndex((c) => c.key === chunkKey)
    if (chunkIndex < 0) return null
    return { lineIndex, chunkIndex, asset: chunks[chunkIndex] }
  }
  return null
}

// ── Particle audio rules ─────────────────────────────────────────
// Particles like が/を should not be synthesized alone.
// Instead, clicking が should play "夜風が" (the preceding word + particle).

const JAPANESE_PARTICLES = new Set([
  'が', 'を', 'に', 'へ', 'で', 'と', 'から', 'まで', 'より', 'の', 'は', 'も', 'や', 'か', 'な', 'ね', 'よ', 'わ',
])

function isStandaloneParticle(text) {
  return JAPANESE_PARTICLES.has(String(text || '').trim())
}

module.exports = {
  MAX_TEXT_CHARS,
  DAILY_UPLOAD_SONG_LIMIT,
  MAX_LINES_PER_USER_SONG,
  DAILY_USER_ASSET_GENERATE_LIMIT,
  DAILY_CUSTOM_TEXT_GENERATE_LIMIT,
  GLOBAL_DAILY_TTS_GENERATE_LIMIT,
  TTS_REQUEST_TIMEOUT_MS,
  ENGINE,
  ENGINE_VERSION,
  DEFAULT_VOICE,
  DEFAULT_SPEAKER,
  DEFAULT_SPEED_SCALE,
  DEFAULT_SLOW_SPEED_SCALE,
  VOICE_SPEAKER_MAP,
  VALID_SOURCES,
  VALID_ASSET_TYPES,
  todayKey,
  normalizeText,
  validateText,
  clampNumber,
  normalizeSpeedScale,
  voiceToSpeaker,
  buildCacheKey,
  buildCloudPath,
  httpRequestJSON,
  getTempURL,
  assetPath,
  findAssetInDoc,
  isStandaloneParticle,
  JAPANESE_PARTICLES,
}
