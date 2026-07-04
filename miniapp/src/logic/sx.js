// Style helper for Taro/weapp: serialize a React-style object into a CSS string,
// appending `px` to unitless numeric lengths. Lets us reuse the web app's inline
// style objects almost verbatim (weapp doesn't reliably auto-px numbers).

import Taro from '@tarojs/taro'

const UNITLESS = new Set([
  'opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow',
  'flexShrink', 'order', 'aspectRatio',
])

// ── Global font scale ───────────────────────────────────────────
const FONT_SCALE_KEY = 'utanote.fontScale'
// Default font scale = the "标准" tier (1.3). The whole app is sized bigger by
// default per design; a user's saved 字号设置 preference still wins over this.
let _fontScale = 1.3

export function initFontScale() {
  try {
    const v = Taro.getStorageSync(FONT_SCALE_KEY)
    if (typeof v === 'number' && v > 0) _fontScale = v
  } catch { /* use default */ }
}

export function getFontScale() { return _fontScale }

export function setFontScale(s) {
  _fontScale = s
  try { Taro.setStorageSync(FONT_SCALE_KEY, s) } catch { /* ignore */ }
}

// ── Core helper ─────────────────────────────────────────────────
export function sx(obj) {
  let out = ''
  for (const k in obj) {
    let val = obj[k]
    if (val == null) continue
    // Scale font sizes globally.
    if (k === 'fontSize' && typeof val === 'number') val = +(val * _fontScale).toFixed(1)
    const prop = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    const v = typeof val === 'number' && !UNITLESS.has(k) ? val + 'px' : val
    out += `${prop}:${v};`
  }
  return out
}
