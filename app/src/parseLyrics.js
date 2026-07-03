// Lyrics → structured lesson data (the `sentence` shape used across the app).
//
// Hybrid pipeline:
//   1. Local (offline, no key): Intl.Segmenter splits each line into tokens;
//      wanakana derives romaji/hiragana where the surface is already kana.
//   2. LLM (OpenAI-compatible, user's key): fills kanji readings, Chinese
//      translation, sentence structure, per-token grammatical roles, and the
//      highlighted-word detail.
//
// With no API key configured, step 2 is skipped and a local-only draft is
// produced (segmentation works; semantics are placeholders) so the flow is
// still demonstrable. Importing the built-in sample returns the curated demo.

import { tokenizeLocal, tokenType, localReading, readingToRomaji } from './nlp/segment.js'
import { chatJSON } from './llm/client.js'
import { sentences as demoSentences, sampleLyrics } from './data.js'
import { hasApiKey } from './config/settings.js'

const MAX_LINES = 40

function pad2(n) {
  return String(n).padStart(2, '0')
}

function splitLines(text) {
  return (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
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

// Normalize one line (+ optional LLM enrichment) into a full sentence object.
function buildSentence(line, i, enrich) {
  const localTokens = tokenizeLocal(line)

  // Prefer the LLM's token list (it knows kanji readings + roles); fall back to
  // the local segmentation.
  const srcTokens =
    enrich && Array.isArray(enrich.tokens) && enrich.tokens.length ? enrich.tokens : localTokens

  const tokens = srcTokens.map((t, idx) => {
    const text = String(t.text ?? localTokens[idx]?.text ?? '')
    const type = tokenType(text)
    const reading = (t.reading && String(t.reading)) || localReading(text)
    return {
      text,
      reading: type === 'particle' ? '' : reading,
      role: (t.role && String(t.role)) || (type === 'particle' ? '助词' : ''),
      type,
    }
  })

  const highlightWord =
    (enrich && enrich.highlightWord && String(enrich.highlightWord)) ||
    tokens.find((t) => t.type === 'content')?.text ||
    ''

  const detailSrc = (enrich && enrich.detail) || {}
  const hlToken = tokens.find((t) => t.text === highlightWord)
  const detail = {
    word: String(detailSrc.word || highlightWord),
    kana: String(detailSrc.kana || hlToken?.reading || ''),
    romaji: String(detailSrc.romaji || readingToRomaji(hlToken?.reading || '')),
    pos: String(detailSrc.pos || ''),
    meaning: String(detailSrc.meaning || '（配置 AI 解析后自动生成）'),
    grammar: String(detailSrc.grammar || ''),
    formula: String(detailSrc.formula || ''),
    tags: Array.isArray(detailSrc.tags) ? detailSrc.tags.map(String).slice(0, 6) : [],
    example: {
      jp: String(detailSrc.example?.jp || ''),
      cn: String(detailSrc.example?.cn || ''),
    },
  }

  const tips = Array.isArray(enrich?.tips)
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
    translation: String(enrich?.translation || '（配置 AI 解析后自动生成中文）'),
    structure: String(enrich?.structure || ''),
    tokens,
    tips,
    detail,
  }
}

const SYSTEM_PROMPT = `你是日语歌词教学解析器。用户会给你若干行日语歌词，以及每行的本地分词结果（仅供参考边界）。
请为每一行输出结构化 JSON，用于中文母语者的日语学习卡片。

只输出 JSON，形如：
{"sentences":[{
  "translation": "该行的自然中文翻译",
  "structure": "整句语法结构，用中文+助词表示，如 主语 + が + 状语 + 宾语 + を + 谓语",
  "highlightWord": "本句最值得讲解的一个词（取自该行原文）",
  "tokens": [{"text":"词","reading":"平假名读音(汉字词必填,纯假名可留空)","role":"中文角色说明,如 主语：夜风 / 主格助词 / 谓语：敲打"}],
  "detail": {"word":"高亮词","kana":"平假名","romaji":"罗马音","pos":"词性","meaning":"中文释义","grammar":"语法解析","formula":"构词/变形公式","tags":["标签"],"example":{"jp":"例句","cn":"例句中文"}},
  "tips": [{"main":"发音要点","label":"简短说明"}]
}]}

规则：
- sentences 的顺序和数量必须与输入行一致。
- reading 一律用平假名。汉字词必须给读音；助词/纯假名词可留空。
- role 用简洁中文；助词写其语法作用（如「主格助词」「宾格助词」）。
- tips 最多 3 条，可为空数组。
- 不要输出 JSON 以外的任何内容。`

function buildUserPrompt(lines) {
  const listed = lines
    .map((line, i) => {
      const seg = tokenizeLocal(line).map((t) => t.text).join(' / ')
      return `${i + 1}. 「${line}」  分词参考: ${seg}`
    })
    .join('\n')
  return `请解析以下 ${lines.length} 行歌词：\n${listed}`
}

export async function parseLyrics(text, settings, { signal } = {}) {
  const allLines = splitLines(text)
  if (allLines.length === 0) throw new Error('没有可解析的歌词，请先输入内容。')
  const truncated = allLines.length > MAX_LINES
  const lines = allLines.slice(0, MAX_LINES)

  // Curated demo shortcut — importing the built-in sample returns the hand-made
  // lesson so the showcase always looks its best.
  const normalized = lines.join('\n').trim()
  if (normalized === sampleLyrics.trim()) {
    return { sentences: demoSentences.map((s) => ({ ...s })), truncated: false, source: 'demo' }
  }

  // No key → local-only draft.
  if (!hasApiKey(settings)) {
    return {
      sentences: lines.map((line, i) => buildSentence(line, i, null)),
      truncated,
      source: 'local',
    }
  }

  // With key → one LLM call enriches every line.
  let enriched = []
  try {
    const out = await chatJSON({
      settings,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(lines),
      signal,
    })
    enriched = Array.isArray(out?.sentences) ? out.sentences : []
  } catch (e) {
    if (e.name === 'AbortError') throw e
    // Surface the error to the caller; the UI decides whether to offer the
    // local-only draft as a fallback.
    e.partial = lines.map((line, i) => buildSentence(line, i, null))
    throw e
  }

  const sentences = lines.map((line, i) => buildSentence(line, i, enriched[i]))
  return { sentences, truncated, source: 'llm' }
}
