const DEFAULT_SPEAKER = Number(process.env.VOICEVOX_DEFAULT_SPEAKER || 2)
const TEXT_MAX_LENGTH = Number(process.env.TEXT_MAX_LENGTH || 120)

function clampNumber(value, fallback, min, max) {
  const n = Number(value == null ? fallback : value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100))
}

function normalizeRequest(body) {
  const text = String(body && body.text ? body.text : '').trim()
  if (!text) return { ok: false, status: 400, code: 'TEXT_EMPTY', message: 'text is required' }
  if (text.length > TEXT_MAX_LENGTH) {
    return { ok: false, status: 400, code: 'TEXT_TOO_LONG', message: `text must be <= ${TEXT_MAX_LENGTH} characters` }
  }
  return {
    ok: true,
    text,
    speaker: Math.max(0, Math.floor(Number(body.speaker == null ? DEFAULT_SPEAKER : body.speaker) || DEFAULT_SPEAKER)),
    speedScale: clampNumber(body.speedScale, 0.9, 0.5, 2.0),
    pitchScale: clampNumber(body.pitchScale, 0, -0.15, 0.15),
    intonationScale: clampNumber(body.intonationScale, 1, 0, 2),
    volumeScale: clampNumber(body.volumeScale, 1, 0, 2),
  }
}

module.exports = { DEFAULT_SPEAKER, TEXT_MAX_LENGTH, clampNumber, normalizeRequest }
