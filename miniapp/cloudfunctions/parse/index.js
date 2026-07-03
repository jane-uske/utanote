// WeChat Cloud Function: parse
// ───────────────────────────────────────────────────────────────
// Turns pasted Japanese lyrics into structured lesson cards.
// Runs on the WeChat cloud (Node.js) — free outbound network, so it calls
// DeepSeek directly. The API key lives in a cloud-function environment
// variable (DEEPSEEK_KEY); the mini-program never sees it.
//
// This is the server half of the hybrid pipeline (mirrors the web app's
// src/parseLyrics.js): local Intl.Segmenter + wanakana do 分词/romaji, the LLM
// adds kanji readings + Chinese semantics. In Node, Intl.Segmenter is available
// with full ICU, so tokenization runs here instead of on the (limited) device.
//
// Deploy: right-click this folder in WeChat DevTools → "上传并部署".
// Set the key: cloud console → this function → 环境变量 → DEEPSEEK_KEY.

const wanakana = require('wanakana')
const https = require('https')
const http = require('http')
const { URL } = require('url')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const DAILY_LIMIT = 5        // songs per openid per day
const MAX_LINES = 40         // lines parsed per request
const MAX_CHARS = 5000       // total chars per request
const MAX_LINE_CHARS = 240   // chars per line (excess is cut)
const CHUNK_SIZE = 8         // lines per LLM batch
const MAX_CONCURRENCY = 4    // concurrent LLM batch requests
const HTTP_TIMEOUT = 60000   // ms

const DEFAULT_BASE = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'

const PARTICLES = new Set([
  'が', 'を', 'に', 'は', 'へ', 'で', 'と', 'も', 'の', 'や', 'か',
  'ね', 'よ', 'から', 'まで', 'なら', 'ば', 'ても', 'でも', 'ので', 'のに',
])

let segmenter = null
function getSegmenter() {
  if (segmenter) return segmenter
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
    } catch {
      segmenter = null
    }
  }
  return segmenter
}

function segment(line) {
  const text = (line || '').trim()
  if (!text) return []
  const seg = getSegmenter()
  if (seg) {
    return [...seg.segment(text)].map((s) => s.segment).filter((s) => s.trim())
  }
  return text.split(/(\s+)/).filter((s) => s.trim())
}

function tokenType(surface) {
  return PARTICLES.has(surface) ? 'particle' : 'content'
}
function localReading(surface) {
  return wanakana.isKana(surface) ? wanakana.toHiragana(surface) : ''
}
function readingToRomaji(reading) {
  return reading ? wanakana.toRomaji(reading) : ''
}
function tokenizeLocal(line) {
  return segment(line).map((surface) => ({
    text: surface,
    reading: localReading(surface),
    type: tokenType(surface),
  }))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}
function splitLines(text) {
  return (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}
function furiganaOf(tokens) {
  return tokens.map((t) => t.reading || t.text).join(' ')
}
// Particles keep their spoken reading, not the kana's literal romaji.
function particleRomaji(surface) {
  if (surface === 'は') return 'wa'
  if (surface === 'を') return 'o'
  if (surface === 'へ') return 'e'
  return readingToRomaji(surface)
}
function romajiOf(tokens) {
  return tokens
    .map((t) => {
      if (t.type === 'particle') return particleRomaji(t.text)
      return readingToRomaji(t.reading || '')
    })
    .filter(Boolean)
    .join(' ')
}

function buildSentence(line, i, enrich) {
  const localTokens = tokenizeLocal(line)
  const enrichTokens = enrich && Array.isArray(enrich.tokens) ? enrich.tokens : []

  const tokens = localTokens.map((local, idx) => {
    const t = enrichTokens[idx] || {}
    const text = String(local.text || '')
    const type = tokenType(text)
    const reading = (t.reading && String(t.reading)) || localReading(text)
    return {
      text,
      reading: type === 'particle' ? '' : reading,
      role: (t.role && String(t.role)) || (type === 'particle' ? '助词' : ''),
      type,
    }
  })

  const firstContent = tokens.find((t) => t.type === 'content')
  const enrichHighlight = enrich && enrich.highlightWord && String(enrich.highlightWord)
  const highlightWord = enrichHighlight && line.includes(enrichHighlight)
    ? enrichHighlight
    : (firstContent ? firstContent.text : '')

  const d = (enrich && enrich.detail) || {}
  const hl = tokens.find((t) => t.text === highlightWord)
  const detailWord = d.word && line.includes(String(d.word)) ? String(d.word) : highlightWord
  const detail = {
    word: detailWord,
    kana: String(d.kana || (hl ? hl.reading : '')),
    romaji: String(d.romaji || readingToRomaji(hl ? hl.reading : '')),
    pos: String(d.pos || ''),
    meaning: String(d.meaning || '（配置 AI 解析后自动生成）'),
    grammar: String(d.grammar || ''),
    formula: String(d.formula || ''),
    tags: Array.isArray(d.tags) ? d.tags.map(String).slice(0, 6) : [],
    example: { jp: String((d.example && d.example.jp) || ''), cn: String((d.example && d.example.cn) || '') },
  }

  const tips = Array.isArray(enrich && enrich.tips)
    ? enrich.tips.slice(0, 3).map((t) => ({ main: String(t.main || ''), label: String(t.label || '') }))
    : []

  return {
    num: i + 1,
    label: pad2(i + 1),
    status: i < 2 ? '新学' : '待学习',
    original: line,
    highlightWord,
    furigana: furiganaOf(tokens),
    romaji: romajiOf(tokens),
    translation: String((enrich && enrich.translation) || '（配置 AI 解析后自动生成中文）'),
    structure: String((enrich && enrich.structure) || ''),
    tokens,
    tips,
    detail,
  }
}

const SYSTEM_PROMPT = `你是日语歌词教学解析器。用户会给你若干行日语歌词，以及每行的本地分词结果（仅供参考边界）。
请为每一行输出结构化 JSON，用于中文母语者的日语学习卡片。

只输出 JSON，形如：
{"sentences":[{
  "translation":"该行的自然中文翻译",
  "structure":"整句语法结构，如 主语 + が + 状语 + 宾语 + を + 谓语",
  "highlightWord":"本句最值得讲解的一个词（取自该行原文）",
  "tokens":[{"text":"词","reading":"平假名读音(汉字词必填,纯假名可留空)","role":"中文角色,如 主语：夜风 / 主格助词 / 谓语：敲打"}],
  "detail":{"word":"高亮词","kana":"平假名","romaji":"罗马音","pos":"词性","meaning":"中文释义","grammar":"语法解析","formula":"构词/变形公式","tags":["标签"],"example":{"jp":"例句","cn":"例句中文"}},
  "tips":[{"main":"发音要点","label":"简短说明"}]
}]}

规则：
- sentences 的顺序和数量必须与输入行一致。
- reading 一律用平假名；汉字词必须给读音，助词/纯假名可留空。
- 日语原文、highlightWord、tokens.text、detail.word、detail.example.jp 必须保留日语原字形，不要改成中文简体字；例如「夜風」不能写成「夜风」。
- role 用简洁中文；助词写其语法作用（如「主格助词」）。
- tips 最多 3 条，可为空数组。
- 只输出 JSON，不要任何多余文字。`

function buildUserPrompt(lines) {
  const listed = lines
    .map((line, i) => `${i + 1}. 「${line}」  分词参考: ${tokenizeLocal(line).map((t) => t.text).join(' / ')}`)
    .join('\n')
  return `请解析以下 ${lines.length} 行歌词：\n${listed}`
}

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

function httpRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(parsed, options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve({ statusCode: res.statusCode, body: raw })
      })
    })
    req.on('error', reject)
    req.setTimeout(HTTP_TIMEOUT, () => { req.destroy(new Error('LLM request timeout')) })
    if (body) req.write(body)
    req.end()
  })
}

async function callLLM({ baseURL, apiKey, model, lines }) {
  const url = baseURL.replace(/\/+$/, '') + '/chat/completions'
  const payload = JSON.stringify({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(lines) },
    ],
  })
  const res = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload)
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`LLM ${res.statusCode}: ${(res.body || '').slice(0, 300)}`)
  }
  const data = JSON.parse(res.body)
  const content = data && data.choices && data.choices[0] && data.choices[0].message.content
  const usage = (data && data.usage) || {}
  const out = extractJSON(content)
  return {
    sentences: Array.isArray(out && out.sentences) ? out.sentences : [],
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    },
  }
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

// Call LLM in batches of CHUNK_SIZE lines, at most MAX_CONCURRENCY in flight.
// Returns { enriched: Array, warnings: string[] }.
// - enriched[i] is the LLM result for line i, or null if unavailable.
// - Every chunk contributes exactly chunk-length slots, so a batch that
//   fails or returns a wrong count never shifts the lines after it.
async function callLLMChunked({ baseURL, apiKey, model, lines }) {
  const chunks = chunk(lines, CHUNK_SIZE)
  const results = await runWithConcurrency(
    chunks,
    MAX_CONCURRENCY,
    (ch) => callLLM({ baseURL, apiKey, model, lines: ch })
  )
  const enriched = []
  const warnings = []
  const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  for (let ci = 0; ci < results.length; ci++) {
    const r = results[ci]
    if (r.status === 'fulfilled') {
      const arr = Array.isArray(r.value.sentences) ? r.value.sentences : []
      if (arr.length !== chunks[ci].length) {
        warnings.push(`批次 ${ci + 1}/${chunks.length} 返回数量异常，已自动对齐`)
      }
      for (let j = 0; j < chunks[ci].length; j++) {
        enriched.push(arr[j] || null)
      }
      totalUsage.prompt_tokens += r.value.usage.prompt_tokens
      totalUsage.completion_tokens += r.value.usage.completion_tokens
      totalUsage.total_tokens += r.value.usage.total_tokens
    } else {
      const errMsg = (r.reason && r.reason.message) || String(r.reason)
      warnings.push(`批次 ${ci + 1}/${chunks.length} 失败: ${errMsg}`)
      for (let j = 0; j < chunks[ci].length; j++) enriched.push(null)
    }
  }
  return { enriched, warnings, usage: totalUsage }
}

// Cloud function entry.
// event: { lyrics: string, apiKey?, baseURL?, model? }
// The key normally comes from process.env.DEEPSEEK_KEY; event.apiKey is a
// BYO-key escape hatch if you'd rather let the user supply their own.
exports.main = async (event = {}) => {
  const startTime = Date.now()
  const { OPENID } = cloud.getWXContext()

  // ── Rate limiting ──────────────────────────────────────────────
  if (OPENID) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { total } = await db.collection('parse_logs')
        .where({ openid: OPENID, createdAt: _.gte(today) })
        .count()
      if (total >= DAILY_LIMIT) {
        return { ok: false, error: `今日解析次数已达上限（${DAILY_LIMIT}首/天），明天再来吧。` }
      }
    } catch (e) {
      console.warn('rate limit check failed:', e)
      // Don't block if the db check fails
    }
  }

  // ── Input limits (server-side, so oversized payloads never reach the LLM) ──
  const rawLyrics = String(event.lyrics || '')
  if (!rawLyrics.trim()) return { ok: false, error: '没有可解析的歌词。' }
  if (rawLyrics.length > MAX_CHARS) {
    return { ok: false, error: `歌词过长，最多支持 ${MAX_CHARS} 字。` }
  }

  const apiKey = (process.env.DEEPSEEK_KEY || '').trim()
  const baseURL = (process.env.DEEPSEEK_BASE || DEFAULT_BASE).trim()
  const model = (process.env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim()

  // splitLines trims each line and drops empties; then cap line length + count.
  const all = splitLines(rawLyrics).map((l) => l.slice(0, MAX_LINE_CHARS))
  if (all.length === 0) return { ok: false, error: '没有可解析的歌词。' }
  const truncated = all.length > MAX_LINES
  const lines = all.slice(0, MAX_LINES)

  let source = 'local'
  let tokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  let warning

  if (!apiKey) {
    // No key → local-only draft
    const sentences = lines.map((l, i) => buildSentence(l, i, null))
    return { ok: true, source, truncated, sentences }
  }

  const { enriched, warnings, usage } = await callLLMChunked({ baseURL, apiKey, model, lines })
  tokenUsage = usage
  const allNull = enriched.every((e) => e == null)
  source = allNull ? 'local' : warnings.length ? 'partial' : 'llm'
  warning = warnings.length ? 'AI 部分解析失败，已对失败行降级为本地草稿：' + warnings.join('；') : undefined

  const sentences = lines.map((l, i) => buildSentence(l, i, enriched[i]))

  // ── Log to cloud database ─────────────────────────────────────
  if (OPENID) {
    try {
      await db.collection('parse_logs').add({
        data: {
          openid: OPENID,
          lineCount: lines.length,
          source,
          tokenUsage,
          duration: Date.now() - startTime,
          createdAt: db.serverDate(),
        },
      })
    } catch (e) {
      console.warn('log write failed:', e)
    }
  }

  return { ok: true, source, truncated, warning, sentences }
}
