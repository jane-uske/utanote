// Pure, dependency-free helpers for the askLine cloud function.
// Extracted from index.js so validation / cache-key / prompt / answer-shape
// logic can be unit-tested without the WeChat cloud SDK.

const crypto = require('crypto')

function envNumber(name, fallback, min, max) {
  const raw = process.env[name]
  const n = raw == null || raw === '' ? fallback : Number(raw)
  const safe = Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, safe))
}

// Bump PROMPT_VERSION whenever the prompt or answer schema changes — it is
// part of the cache key, so old cached answers are naturally left behind
// instead of being served against a newer prompt contract.
const PROMPT_VERSION = 'singing-v1'

const MAX_TEXT_CHARS = envNumber('AI_TEXT_MAX_LENGTH', 120, 1, 500)
const MAX_KANA_CHARS = envNumber('AI_KANA_MAX_LENGTH', 240, 1, 1000)
const DAILY_USER_AI_ASK_LIMIT = envNumber('DAILY_USER_AI_ASK_LIMIT', 30, 0, 10000)
const GLOBAL_DAILY_AI_ASK_LIMIT = envNumber('GLOBAL_DAILY_AI_ASK_LIMIT', 2000, 0, 100000)
const AI_REQUEST_TIMEOUT_MS = envNumber('AI_REQUEST_TIMEOUT_MS', 45000, 1000, 60000)

// P0 ships the singing coach only; more question types slot in here later.
const QUESTION_TYPES = new Set(['singing'])

const CONTENT_SAFETY_CHUNK_SIZE = 2000

// Same orthography guard as TTS: WeChat input methods love to slip the
// simplified 风 into Japanese text; normalize before hashing/prompting so
// the same line always lands on the same cache entry.
const JP_ORTHOGRAPHY_REPLACEMENTS = { '风': '風' }

function normalizeText(text) {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ')
  return normalized.replace(/[风]/g, (char) => JP_ORTHOGRAPHY_REPLACEMENTS[char] || char)
}

function normalizeQuestionType(value) {
  const v = String(value || '').trim()
  return QUESTION_TYPES.has(v) ? v : ''
}

// kana is optional context (mora segmentation for kanji); collapse the
// per-word spaces the parser uses for furigana display.
function normalizeLine(line) {
  const src = line && typeof line === 'object' ? line : {}
  const text = normalizeText(src.text)
  if (!text) return { ok: false, code: 'TEXT_EMPTY', message: '没有可讲解的歌词。' }
  if (text.length > MAX_TEXT_CHARS) {
    return { ok: false, code: 'TEXT_TOO_LONG', message: `这句歌词太长了，最多支持 ${MAX_TEXT_CHARS} 字。` }
  }
  const kana = normalizeText(src.kana).replace(/\s+/g, '').slice(0, MAX_KANA_CHARS)
  return { ok: true, line: { text, kana } }
}

function hash(value, len = 32) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, len)
}

// Content-addressed: the key is derived from everything that shapes the
// answer (prompt version, model, question, line text + reading) and nothing
// else — so the cache is global across users, and a client sending made-up
// text can only ever pollute its own made-up key, never a real line's entry.
function buildCacheKey({ questionType, text, kana, model }) {
  return hash([
    PROMPT_VERSION,
    String(model || ''),
    String(questionType || ''),
    normalizeText(text),
    normalizeText(kana).replace(/\s+/g, ''),
  ].join('\n'))
}

// The coach may only teach what is derivable from the written line. It never
// hears the melody, so anything melody-shaped (pitch, breath points, rhythm
// patterns) is explicitly forbidden — that would be pure hallucination.
const SINGING_SYSTEM_PROMPT = `你是日语歌唱发音教练，学员是正在学唱日语歌的中文母语者。你会拿到一句歌词的原文和假名读音，请讲解这句词唱出来时要注意什么。

你只能讲从文字本身就能确定的唱法规则，例如：
- 音拍（モーラ）切分：唱歌通常一拍一个音拍
- 长音要拖满拍，不能唱成短音
- 促音「っ」自己占一拍的位置，表现为停顿，不发音
- 拨音「ん」单独占一拍，不要吞掉
- 助词的实际读法（は→wa、へ→e、を→o）
- 口语里元音无声化的音（如 です、〜ます）唱歌时通常要把元音唱满
- 中文母语者易混的音：拗音、长短音、清浊音、ザ行/ジャ行等

你听不到旋律，因此严禁编造任何与旋律相关的内容：不要谈音高、升降调，不要指定换气位置，不要描述节奏型或哪个字对哪个音符。

只输出 JSON，形如：
{"kanaBeats":"整句按音拍用・分隔的平假名，例：よ・か・ぜ・が・し・ず・か・に",
 "tips":[{"title":"要点标题（10字以内）","detail":"具体怎么唱，中文说明（60字以内）"}],
 "watchOut":"这句最容易唱错的一个点，一句话"}

规则：
- kanaBeats 必须覆盖整句：促音写「っ」自身占一位；长音的「ー」或第二个元音自身占一位。
- tips 给 2~4 条，只挑这句真正用得上的规则，不要凑数。
- 中文书写（日语字词除外），不要出现罗马音以外的注音方式混用。
- 只输出 JSON，不要任何多余文字。`

function buildSingingMessages({ text, kana }) {
  const kanaLine = kana ? `假名读音：「${kana}」` : '假名读音：（未提供，请自行判断汉字读音）'
  return [
    { role: 'system', content: SINGING_SYSTEM_PROMPT },
    { role: 'user', content: `歌词原句：「${text}」\n${kanaLine}\n请讲解这句歌词唱的时候要注意什么。` },
  ]
}

// Extract a JSON object from an LLM reply that may be fenced (```json … ```)
// or padded with surrounding prose. (Same contract as the parse function.)
function extractJSON(text) {
  if (!text) throw new Error('模型返回为空')
  let t = String(text).trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  if (t[0] !== '{') {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) t = t.slice(a, b + 1)
  }
  return JSON.parse(t)
}

function clampString(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

// Coerce the raw LLM object into the answer shape the client renders, or
// throw — the caller treats a throw as "bad answer, retry once".
function normalizeAnswer(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('答案不是对象')
  const kanaBeats = clampString(raw.kanaBeats, 200)
  const tips = (Array.isArray(raw.tips) ? raw.tips : [])
    .map((t) => ({
      title: clampString(t && t.title, 20),
      detail: clampString(t && t.detail, 120),
    }))
    .filter((t) => t.title && t.detail)
    .slice(0, 4)
  const watchOut = clampString(raw.watchOut, 120)
  if (!kanaBeats && !tips.length) throw new Error('答案缺少 kanaBeats 和 tips')
  return { kanaBeats, tips, watchOut }
}

// One string covering every human-visible field, for msgSecCheck.
function answerToSafetyText(answer) {
  const parts = [answer.kanaBeats, answer.watchOut]
  for (const t of answer.tips || []) parts.push(t.title, t.detail)
  return parts.filter(Boolean).join('\n')
}

function splitContentForSafety(text, maxChars = CONTENT_SAFETY_CHUNK_SIZE) {
  const source = String(text || '').trim()
  if (!source) return []
  const out = []
  for (let i = 0; i < source.length; i += maxChars) {
    out.push(source.slice(i, i + maxChars))
  }
  return out
}

function contentSafetyDecision(resp) {
  const rawCode = resp && (resp.errCode != null ? resp.errCode : resp.errcode)
  const errCode = Number(rawCode == null ? 0 : rawCode)
  if (errCode === 87014) return { ok: false, code: 'CONTENT_RISK' }
  if (errCode !== 0) return { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE' }

  const result = (resp && resp.result) || {}
  const suggest = String(result.suggest || result.Suggest || '').toLowerCase()
  const label = result.label == null ? null : Number(result.label)
  if (suggest === 'pass' || label === 100) return { ok: true }
  if (suggest === 'risky' || suggest === 'review' || (label != null && label !== 100)) {
    return { ok: false, code: 'CONTENT_RISK' }
  }
  return { ok: true }
}

module.exports = {
  PROMPT_VERSION,
  MAX_TEXT_CHARS,
  MAX_KANA_CHARS,
  DAILY_USER_AI_ASK_LIMIT,
  GLOBAL_DAILY_AI_ASK_LIMIT,
  AI_REQUEST_TIMEOUT_MS,
  QUESTION_TYPES,
  normalizeText,
  normalizeQuestionType,
  normalizeLine,
  buildCacheKey,
  buildSingingMessages,
  extractJSON,
  normalizeAnswer,
  answerToSafetyText,
  splitContentForSafety,
  contentSafetyDecision,
}
