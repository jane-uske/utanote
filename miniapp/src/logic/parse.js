// Calls the `parse` cloud function. No request-domain whitelist needed —
// wx.cloud.callFunction goes through WeChat's cloud, not the device network.

import Taro from '@tarojs/taro'

// Mirrors the server-side heuristic in cloudfunctions/parse/helpers.js — real
// Japanese lyrics always mix in hiragana/katakana (particles, verb endings),
// so kana-free text (plain Chinese, English, etc.) is rejected client-side
// before it spends a cloud call or a daily-quota slot.
const JA_KANA_MIN_RATIO = 0.15
export function looksJapanese(text) {
  const chars = String(text || '').replace(/\s/g, '')
  if (!chars) return false
  const kana = (chars.match(/[぀-ゟ゠-ヿ]/g) || []).length
  return kana / chars.length >= JA_KANA_MIN_RATIO
}

export async function parseLyrics(lyrics) {
  let res
  try {
    res = await Taro.cloud.callFunction({
      name: 'parse',
      data: { lyrics },
    })
  } catch (e) {
    throw new Error('云函数调用失败：' + (e.errMsg || e.message || e) + '（请确认已开通云开发并部署 parse 云函数）')
  }
  const r = res && res.result
  if (!r || !r.ok) throw new Error((r && r.error) || '解析失败，请重试。')
  return r // { ok, source, truncated, warning?, sentences }
}
