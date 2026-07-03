const DEFAULT_SPEAKER = Number(process.env.UTANOTE_TTS_DEFAULT_SPEAKER || 2)

function clampNumber(value, fallback, min, max) {
  const n = Number(value == null ? fallback : value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100))
}

function normalizeRequest(body) {
  const text = String(body && body.text ? body.text : '').trim()
  if (!text) return { ok: false, status: 400, code: 'EMPTY_TEXT', message: 'text is required' }
  if (text.length > 120) return { ok: false, status: 400, code: 'TEXT_TOO_LONG', message: 'text must be <= 120 characters' }
  return {
    ok: true,
    text,
    speaker: Math.max(0, Math.floor(Number(body.speaker == null ? DEFAULT_SPEAKER : body.speaker) || DEFAULT_SPEAKER)),
    speedScale: clampNumber(body.speedScale, 0.9, 0.5, 1.5),
    pitchScale: clampNumber(body.pitchScale, 0, -0.15, 0.15),
    intonationScale: clampNumber(body.intonationScale, 1, 0, 2),
  }
}

module.exports = { DEFAULT_SPEAKER, clampNumber, normalizeRequest }
