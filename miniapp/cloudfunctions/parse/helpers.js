// Pure, dependency-free helpers for the parse cloud function.
// Extracted from index.js so the batching / concurrency / alignment /
// degradation logic can be unit-tested without the WeChat cloud SDK.
// index.js re-imports these; behaviour is identical to the inline versions.

// Extract a JSON object from an LLM reply that may be fenced (```json … ```)
// or padded with surrounding prose.
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

// Split an array into chunks of at most `size` elements.
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Run `worker` over `items` with at most `limit` in flight at once.
// Returns Promise.allSettled-shaped results, in input order.
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function run() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      try {
        results[current] = {
          status: 'fulfilled',
          value: await worker(items[current], current),
        }
      } catch (e) {
        results[current] = {
          status: 'rejected',
          reason: e,
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run)
  )

  return results
}

// Merge per-chunk settled results back into a flat, line-aligned array.
// Every chunk contributes exactly chunk-length slots, so a batch that fails
// or returns the wrong count never shifts the lines after it:
// - a short/failed batch fills its remaining slots with null (local fallback),
// - an overflowing batch has its extras dropped.
// Returns { enriched, warnings, usage, title }. `title` only ever comes from
// chunk 0 (the only chunk asked to guess one — see index.js's TITLE_SUFFIX).
function mergeChunkResults(results, chunks) {
  const enriched = []
  const warnings = []
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  let title = ''
  for (let ci = 0; ci < results.length; ci++) {
    const r = results[ci]
    if (r.status === 'fulfilled') {
      const arr = Array.isArray(r.value && r.value.sentences) ? r.value.sentences : []
      if (arr.length !== chunks[ci].length) {
        warnings.push(`批次 ${ci + 1}/${chunks.length} 返回数量异常，已自动对齐`)
      }
      for (let j = 0; j < chunks[ci].length; j++) enriched.push(arr[j] || null)
      if (ci === 0 && r.value && r.value.title) title = r.value.title
      const u = (r.value && r.value.usage) || {}
      usage.prompt_tokens += u.prompt_tokens || 0
      usage.completion_tokens += u.completion_tokens || 0
      usage.total_tokens += u.total_tokens || 0
    } else {
      const errMsg = (r.reason && r.reason.message) || String(r.reason)
      warnings.push(`批次 ${ci + 1}/${chunks.length} 失败: ${errMsg}`)
      for (let j = 0; j < chunks[ci].length; j++) enriched.push(null)
    }
  }
  return { enriched, warnings, usage, title }
}

// Heuristic Japanese-lyrics gate: real Japanese virtually always mixes in
// hiragana/katakana (particles, verb endings), so kana-free text — plain
// Chinese, English, or other scripts — reads as "not Japanese" and gets
// rejected before it burns an LLM call or a daily-quota slot. Mirrored
// client-side in miniapp/src/logic/parse.js so the rejection is instant.
const JA_KANA_MIN_RATIO = 0.15
function looksJapanese(text) {
  const chars = String(text || '').replace(/\s/g, '')
  if (!chars) return false
  const kana = (chars.match(/[぀-ゟ゠-ヿ]/g) || []).length
  return kana / chars.length >= JA_KANA_MIN_RATIO
}

// Pick the token track for one line. The local segmenter (Intl.Segmenter)
// and the LLM tokenize independently and DISAGREE on word boundaries
// (e.g. local 薄|く vs LLM 薄く) — pasting LLM data onto local tokens by
// index silently shifts every reading/role one slot over (the 口触り bug).
// So: the LLM track is used only when its token texts exactly reconstruct
// the line (whitespace ignored); otherwise fall back to the pure local
// track WITHOUT any LLM data — a missing reading beats a wrong one.
//
// localTokens: [{text, reading, type}] from the local segmenter.
// enrichTokens: [{text, reading, role}] from the LLM (untrusted).
// isParticle: (text) => bool — kept as a parameter so this stays pure.
function buildTokenTrack({ line, localTokens, enrichTokens, isParticle }) {
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, '')
  const llm = Array.isArray(enrichTokens) ? enrichTokens : []
  const reconstructs = llm.length > 0
    && llm.every((t) => t && typeof t.text === 'string' && t.text.trim())
    && clean(llm.map((t) => t.text).join('')) === clean(line)

  if (reconstructs) {
    return llm.map((t) => {
      const text = String(t.text).trim()
      const particle = isParticle(text)
      return {
        text,
        reading: particle ? '' : String(t.reading || ''),
        role: String(t.role || (particle ? '助词' : '')),
        type: particle ? 'particle' : 'content',
      }
    })
  }

  return (Array.isArray(localTokens) ? localTokens : []).map((t) => ({
    text: String(t.text || ''),
    reading: t.type === 'particle' ? '' : String(t.reading || ''),
    role: t.type === 'particle' ? '助词' : '',
    type: t.type === 'particle' ? 'particle' : 'content',
  }))
}

const CONTENT_SAFETY_CHUNK_SIZE = 2000
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
  extractJSON,
  chunk,
  runWithConcurrency,
  mergeChunkResults,
  buildTokenTrack,
  looksJapanese,
  splitContentForSafety,
  contentSafetyDecision,
}
