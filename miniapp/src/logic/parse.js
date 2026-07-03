// Calls the `parse` cloud function. No request-domain whitelist needed —
// wx.cloud.callFunction goes through WeChat's cloud, not the device network.

import Taro from '@tarojs/taro'

export async function parseLyrics(lyrics, settings) {
  let res
  try {
    res = await Taro.cloud.callFunction({
      name: 'parse',
      data: {
        lyrics,
        // Optional BYO overrides; omitted keys let the cloud function use its
        // own env config (DEEPSEEK_KEY / DEEPSEEK_BASE / DEEPSEEK_MODEL).
        apiKey: settings.apiKey || undefined,
        baseURL: settings.baseURL || undefined,
        model: settings.model || undefined,
      },
    })
  } catch (e) {
    throw new Error('云函数调用失败：' + (e.errMsg || e.message || e) + '（请确认已开通云开发并部署 parse 云函数）')
  }
  const r = res && res.result
  if (!r || !r.ok) throw new Error((r && r.error) || '解析失败，请重试。')
  return r // { ok, source, truncated, warning?, sentences }
}
