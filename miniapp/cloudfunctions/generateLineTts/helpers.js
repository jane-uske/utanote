const crypto = require('crypto')

const MAX_TEXT_CHARS = Number(process.env.TEXT_MAX_LENGTH || 120)
const DAILY_GENERATE_LIMIT = Number(process.env.DAILY_USER_ASSET_GENERATE_LIMIT || 300)
const GLOBAL_DAILY_TTS_GENERATE_LIMIT = Number(process.env.GLOBAL_DAILY_TTS_GENERATE_LIMIT || 3000)
const ENGINE = 'voicevox'
const ENGINE_VERSION = String(process.env.VOICEVOX_ENGINE_VERSION || 'voicevox-v0.1.0')
const DEFAULT_VOICE = 'voicevox_sora_normal'
const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_DEFAULT_SPEAKER || 16)
const DEFAULT_SPEED_SCALE = 0.9
const VOICE_SPEAKER_MAP = {
  voicevox_metan_normal: 2,
  voicevox_zundamon_normal: 3,
  voicevox_tsumugi_normal: 8,
  voicevox_sora_normal: 16,
  voicevox_no7_reading: 31,
  voicevox_default_female: 2,
  [DEFAULT_VOICE]: DEFAULT_SPEAKER,
}
const JP_ORTHOGRAPHY_REPLACEMENTS = {
  风: '風',
}

function normalizeText(text) {
  const normalized = String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
  return normalized.replace(
    /[风]/g,
    (char) => JP_ORTHOGRAPHY_REPLACEMENTS[char] || char,
  )
}

function validateText(text) {
  const normalized = normalizeText(text)
  if (!normalized)
    return { ok: false, code: 'EMPTY_TEXT', message: '朗读文本不能为空。' }
  if (normalized.length > MAX_TEXT_CHARS) {
    return {
      ok: false,
      code: 'TEXT_TOO_LONG',
      message: `这句歌词太长了，最多支持 ${MAX_TEXT_CHARS} 字。`,
    }
  }
  return { ok: true, text: normalized }
}

function normalizeSpeedScale(value) {
  const n = Number(value == null ? DEFAULT_SPEED_SCALE : value)
  if (!Number.isFinite(n)) return DEFAULT_SPEED_SCALE
  return Math.max(0.5, Math.min(2.0, Math.round(n * 100) / 100))
}

function voiceToSpeaker(voice) {
  return VOICE_SPEAKER_MAP[voice] || DEFAULT_SPEAKER
}

/**
 * Global cache key — no openid, no songId.
 * Same text + voice + speaker + speed → same audio file for the whole platform.
 */
function buildCacheKey({ songId, lineId, text, voice, speedScale }) {
  const source = [
    normalizeText(text),
    String(voice || DEFAULT_VOICE),
    String(voiceToSpeaker(voice)),
    String(normalizeSpeedScale(speedScale)),
    '0',     // pitchScale
    '1',     // intonationScale
    ENGINE,
    ENGINE_VERSION,
  ].join('\n')
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 32)
}

function cloudPathSegment(value, fallback) {
  const raw = String(value || fallback || '').trim()
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || fallback
}

module.exports = {
  MAX_TEXT_CHARS,
  DAILY_GENERATE_LIMIT,
  GLOBAL_DAILY_TTS_GENERATE_LIMIT,
  ENGINE,
  ENGINE_VERSION,
  DEFAULT_VOICE,
  DEFAULT_SPEAKER,
  DEFAULT_SPEED_SCALE,
  VOICE_SPEAKER_MAP,
  normalizeText,
  validateText,
  normalizeSpeedScale,
  voiceToSpeaker,
  buildCacheKey,
  cloudPathSegment,
}
