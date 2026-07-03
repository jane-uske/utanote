// AI-parsing settings for the mini-program.
//
// In the cloud-function model the DeepSeek key normally lives in the cloud
// function's env var (DEEPSEEK_KEY), so these fields are OPTIONAL overrides — if
// the user fills them, they're forwarded to the `parse` cloud function; if left
// blank, the cloud function uses its own env config.

import Taro from '@tarojs/taro'

const KEY = 'utanote.llm.settings'

export const DEFAULT_SETTINGS = { baseURL: '', apiKey: '', model: '' }

export function loadSettings() {
  try {
    const r = Taro.getStorageSync(KEY)
    return r ? { ...DEFAULT_SETTINGS, ...r } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s) {
  const clean = {
    baseURL: (s.baseURL || '').trim(),
    apiKey: (s.apiKey || '').trim(),
    model: (s.model || '').trim(),
  }
  try {
    Taro.setStorageSync(KEY, clean)
  } catch {
    /* ignore */
  }
  return clean
}

export function hasApiKey(s) {
  return !!(s && s.apiKey && s.apiKey.trim())
}
