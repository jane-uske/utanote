// AI-parsing settings — user-supplied OpenAI-compatible endpoint.
// Stored only in the browser (localStorage). The API key is the user's own;
// nothing is sent anywhere except the endpoint they configure.

const KEY = 'utanote.llm.settings'

export const DEFAULT_SETTINGS = {
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
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
    localStorage.setItem(KEY, JSON.stringify(clean))
  } catch {
    /* ignore quota / private-mode errors */
  }
  return clean
}

export function hasApiKey(s) {
  return !!(s && s.apiKey && s.apiKey.trim())
}
