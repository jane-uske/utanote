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

const DEFAULT_BASE = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'
const MAX_LINES = 40

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
function romajiOf(tokens) {
  return tokens
    .map((t) => readingToRomaji(t.reading || (t.type === 'content' ? '' : t.text)))
    .filter(Boolean)
    .join(' ')
}

function buildSentence(line, i, enrich) {
  const localTokens = tokenizeLocal(line)
  const srcTokens =
    enrich && Array.isArray(enrich.tokens) && enrich.tokens.length ? enrich.tokens : localTokens

  const tokens = srcTokens.map((t, idx) => {
    const text = String(t.text != null ? t.text : localTokens[idx] ? localTokens[idx].text : '')
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
  const highlightWord =
    (enrich && enrich.highlightWord && String(enrich.highlightWord)) ||
    (firstContent ? firstContent.text : '')

  const d = (enrich && enrich.detail) || {}
  const hl = tokens.find((t) => t.text === highlightWord)
  const detail = {
    word: String(d.word || highlightWord),
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

async function callLLM({ baseURL, apiKey, model, lines }) {
  const url = baseURL.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(lines) },
      ],
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new Error(`LLM ${res.status}${detail ? ': ' + detail : ''}`)
  }
  const data = await res.json()
  const content = data && data.choices && data.choices[0] && data.choices[0].message.content
  const out = extractJSON(content)
  return Array.isArray(out && out.sentences) ? out.sentences : []
}

// Cloud function entry.
// event: { lyrics: string, apiKey?, baseURL?, model? }
// The key normally comes from process.env.DEEPSEEK_KEY; event.apiKey is a
// BYO-key escape hatch if you'd rather let the user supply their own.
exports.main = async (event = {}) => {
  const lyrics = event.lyrics || ''
  const apiKey = (event.apiKey || process.env.DEEPSEEK_KEY || '').trim()
  const baseURL = (event.baseURL || process.env.DEEPSEEK_BASE || DEFAULT_BASE).trim()
  const model = (event.model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim()

  const all = splitLines(lyrics)
  if (all.length === 0) return { ok: false, error: '没有可解析的歌词。' }
  const truncated = all.length > MAX_LINES
  const lines = all.slice(0, MAX_LINES)

  // No key → local-only draft (segmentation works; semantics are placeholders).
  if (!apiKey) {
    return { ok: true, source: 'local', truncated, sentences: lines.map((l, i) => buildSentence(l, i, null)) }
  }

  try {
    const enriched = await callLLM({ baseURL, apiKey, model, lines })
    return {
      ok: true,
      source: 'llm',
      truncated,
      sentences: lines.map((l, i) => buildSentence(l, i, enriched[i])),
    }
  } catch (e) {
    // Degrade to the local draft and report why, rather than failing hard.
    return {
      ok: true,
      source: 'local',
      truncated,
      warning: 'AI 解析失败，已降级为本地草稿：' + (e.message || e),
      sentences: lines.map((l, i) => buildSentence(l, i, null)),
    }
  }
}
