const crypto = require('crypto')

function envNumber(name, fallback, min, max) {
  const raw = process.env[name]
  const n = raw == null || raw === '' ? fallback : Number(raw)
  const safe = Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, safe))
}

const MAX_TEXT_CHARS = envNumber('TEXT_MAX_LENGTH', 120, 1, 500)
const DAILY_USER_ASSET_GENERATE_LIMIT = envNumber('DAILY_USER_ASSET_GENERATE_LIMIT', 300, 0, 10000)
const DAILY_GENERATE_LIMIT = DAILY_USER_ASSET_GENERATE_LIMIT
const DAILY_CUSTOM_TEXT_GENERATE_LIMIT = envNumber('DAILY_CUSTOM_TEXT_GENERATE_LIMIT', 100, 0, 10000)
const GLOBAL_DAILY_TTS_GENERATE_LIMIT = envNumber('GLOBAL_DAILY_TTS_GENERATE_LIMIT', 3000, 0, 100000)
const TTS_REQUEST_TIMEOUT_MS = envNumber('TTS_REQUEST_TIMEOUT_MS', 15000, 1000, 60000)

const ENGINE = 'voicevox'
const ENGINE_VERSION = process.env.VOICEVOX_ENGINE_VERSION || 'voicevox-v1'
const DEFAULT_VOICE = 'voicevox_sora_normal'
const DEFAULT_SPEAKER = 16
const DEFAULT_SPEED_SCALE = 0.9
const DEFAULT_PITCH_SCALE = 0
const DEFAULT_INTONATION_SCALE = 1
const DEFAULT_VOLUME_SCALE = 1

const SOURCE_TYPES = new Set(['platform_card', 'whitelist_song', 'user_uploaded_song', 'user_custom_text'])
const ASSET_TYPES = new Set(['sentence_normal', 'sentence_slow', 'chunk', 'word', 'example', 'custom_text'])
const FREE_SOURCES = new Set(['platform_card', 'whitelist_song'])

const VOICE_SPEAKER_MAP = {
  voicevox_metan_normal: 2,
  voicevox_zundamon_normal: 3,
  voicevox_tsumugi_normal: 8,
  voicevox_sora_normal: 16,
  voicevox_no7_reading: 31,
  voicevox_default_female: 2,
  [DEFAULT_VOICE]: DEFAULT_SPEAKER,
}
const JP_ORTHOGRAPHY_REPLACEMENTS = { '风': '風' }

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

function normalizeSource(source, songId) {
  const fallback = String(songId || '') === 'demo' ? 'platform_card' : 'user_uploaded_song'
  const value = String(source || fallback).trim()
  return SOURCE_TYPES.has(value) ? value : ''
}

function normalizeAssetType(assetType) {
  const value = String(assetType || 'sentence_normal').trim()
  return ASSET_TYPES.has(value) ? value : ''
}

function isFreeSource(source) {
  return FREE_SOURCES.has(source)
}

function normalizeSpeedScale(value) {
  const n = Number(value == null ? DEFAULT_SPEED_SCALE : value)
  if (!Number.isFinite(n)) return DEFAULT_SPEED_SCALE
  return Math.max(0.5, Math.min(1.5, Math.round(n * 100) / 100))
}

function normalizePitchScale(value) {
  const n = Number(value == null ? DEFAULT_PITCH_SCALE : value)
  if (!Number.isFinite(n)) return DEFAULT_PITCH_SCALE
  return Math.max(-0.15, Math.min(0.15, Math.round(n * 100) / 100))
}

function normalizeIntonationScale(value) {
  const n = Number(value == null ? DEFAULT_INTONATION_SCALE : value)
  if (!Number.isFinite(n)) return DEFAULT_INTONATION_SCALE
  return Math.max(0, Math.min(2, Math.round(n * 100) / 100))
}

function normalizeVolumeScale(value) {
  const n = Number(value == null ? DEFAULT_VOLUME_SCALE : value)
  if (!Number.isFinite(n)) return DEFAULT_VOLUME_SCALE
  return Math.max(0, Math.min(2, Math.round(n * 100) / 100))
}

function voiceToSpeaker(voice, speaker) {
  const explicit = Number(speaker)
  if (Number.isFinite(explicit) && explicit >= 0) return explicit
  return VOICE_SPEAKER_MAP[voice] || DEFAULT_SPEAKER
}

function hash(value, len = 32) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, len)
}

function buildCacheKey({ text, voice, speaker, speedScale, pitchScale, intonationScale }) {
  const source = [
    normalizeText(text),
    String(voice || DEFAULT_VOICE),
    String(voiceToSpeaker(voice, speaker)),
    String(normalizeSpeedScale(speedScale)),
    String(normalizePitchScale(pitchScale)),
    String(normalizeIntonationScale(intonationScale)),
    ENGINE,
    ENGINE_VERSION,
  ].join('\n')
  return hash(source)
}

function buildAssetKey({ source, songId, cardId, lineId, assetType, chunkKey, voice, speaker, speedScale, audioText }) {
  return hash([
    source || '', songId || '', cardId || '', lineId || '', assetType || '', chunkKey || '',
    normalizeText(audioText), voice || DEFAULT_VOICE, voiceToSpeaker(voice, speaker), normalizeSpeedScale(speedScale),
  ].join('\n'))
}

function cloudPathSegment(value, fallback) {
  const raw = String(value || fallback || '').trim()
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || fallback
}

function userLimitForSource(source) {
  if (source === 'user_custom_text') return DAILY_CUSTOM_TEXT_GENERATE_LIMIT
  if (source === 'user_uploaded_song') return DAILY_USER_ASSET_GENERATE_LIMIT
  return null
}

function userCounterForSource(source) {
  if (source === 'user_custom_text') return 'customTextGenerateCount'
  if (source === 'user_uploaded_song') return 'generatedAssetCount'
  return null
}

function userLimitCodeForSource(source) {
  if (source === 'user_custom_text') return 'DAILY_CUSTOM_TEXT_LIMIT_EXCEEDED'
  if (source === 'user_uploaded_song') return 'DAILY_USER_ASSET_LIMIT_EXCEEDED'
  return 'DAILY_TTS_LIMIT_EXCEEDED'
}

module.exports = {
  MAX_TEXT_CHARS,
  DAILY_GENERATE_LIMIT,
  DAILY_USER_ASSET_GENERATE_LIMIT,
  DAILY_CUSTOM_TEXT_GENERATE_LIMIT,
  GLOBAL_DAILY_TTS_GENERATE_LIMIT,
  TTS_REQUEST_TIMEOUT_MS,
  ENGINE,
  ENGINE_VERSION,
  DEFAULT_VOICE,
  DEFAULT_SPEAKER,
  DEFAULT_SPEED_SCALE,
  DEFAULT_PITCH_SCALE,
  DEFAULT_INTONATION_SCALE,
  DEFAULT_VOLUME_SCALE,
  VOICE_SPEAKER_MAP,
  SOURCE_TYPES,
  ASSET_TYPES,
  normalizeText,
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
}
