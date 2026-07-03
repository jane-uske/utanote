// Local Japanese NLP — runs fully in the browser, no network, no API key.
// Segmentation via the built-in Intl.Segmenter (ICU word boundaries);
// kana/romaji via wanakana. This is the "local" half of the hybrid pipeline:
// it does 分词 offline; the LLM adds kanji readings + semantics on top.
//
// Upgrade seam: swapping Intl.Segmenter for kuromoji.js here would add
// offline kanji readings (at the cost of a ~5MB dictionary bundle). The rest
// of the pipeline consumes `segment()` / `TokenType` and wouldn't change.

import { toHiragana, toRomaji, isKana } from 'wanakana'

// Common single-role particles — used to tag token type for styling.
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
      return segmenter
    } catch {
      /* fall through */
    }
  }
  return null
}

// Split a line into surface tokens. Falls back to character grouping when
// Intl.Segmenter is unavailable (very old runtimes).
export function segment(line) {
  const text = (line || '').trim()
  if (!text) return []
  const seg = getSegmenter()
  if (seg) {
    return [...seg.segment(text)]
      .map((s) => s.segment)
      .filter((s) => s.trim().length > 0)
  }
  // Naive fallback: keep runs of the same script together.
  return text.split(/(\s+)/).filter((s) => s.trim().length > 0)
}

export function tokenType(surface) {
  if (PARTICLES.has(surface)) return 'particle'
  // A single kana that is a known particle-ish char also reads as particle.
  if (surface.length === 1 && isKana(surface) && PARTICLES.has(surface)) return 'particle'
  return 'content'
}

// Local reading: if the surface is already kana we know its reading; kanji
// readings are left empty for the LLM (or kuromoji) to fill.
export function localReading(surface) {
  if (isKana(surface)) return toHiragana(surface)
  return ''
}

export function readingToRomaji(reading) {
  if (!reading) return ''
  return toRomaji(reading)
}

// Build the offline-only token list for one line.
export function tokenizeLocal(line) {
  return segment(line).map((surface) => ({
    text: surface,
    reading: localReading(surface),
    type: tokenType(surface),
  }))
}
