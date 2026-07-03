// Style helper for Taro/weapp: serialize a React-style object into a CSS string,
// appending `px` to unitless numeric lengths. Lets us reuse the web app's inline
// style objects almost verbatim (weapp doesn't reliably auto-px numbers).

const UNITLESS = new Set([
  'opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow',
  'flexShrink', 'order', 'aspectRatio',
])

export function sx(obj) {
  let out = ''
  for (const k in obj) {
    const val = obj[k]
    if (val == null) continue
    const prop = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
    const v = typeof val === 'number' && !UNITLESS.has(k) ? val + 'px' : val
    out += `${prop}:${v};`
  }
  return out
}
