import Taro from '@tarojs/taro'

const LOCAL_TTS_CACHE = 'utanote.tts.localAudio.v1'
const LOCAL_ENGINE_VERSION = 'voicevox-v1'
const LOCAL_CACHE_LIMIT = 80
const JP_ORTHOGRAPHY_REPLACEMENTS = {
  风: '風',
}

function normalizeText(text) {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ')
  return normalized.replace(/[风]/g, (char) => JP_ORTHOGRAPHY_REPLACEMENTS[char] || char)
}

function stableHash(value) {
  const source = String(value || '')
  let hash = 5381
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash) + source.charCodeAt(i)
    hash >>>= 0
  }
  return hash.toString(16)
}

function readLocalCache() {
  try {
    const value = Taro.getStorageSync(LOCAL_TTS_CACHE)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function writeLocalCache(cache) {
  try {
    const entries = Object.entries(cache)
      .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
      .slice(0, LOCAL_CACHE_LIMIT)
    const next = {}
    entries.forEach(([key, value]) => { next[key] = value })
    Taro.setStorageSync(LOCAL_TTS_CACHE, next)
  } catch {
    // Local audio cache is a speed optimization only.
  }
}

function fileExists(path) {
  if (!path) return false
  try {
    Taro.getFileSystemManager().accessSync(path)
    return true
  } catch {
    return false
  }
}

export function buildTtsLocalCacheKey(data) {
  const source = JSON.stringify({
    songId: data && data.songId,
    lineId: data && data.lineId,
    text: normalizeText(data && data.text),
    voice: (data && data.voice) || 'voicevox_default_female',
    speedScale: data && data.speedScale,
    engineVersion: LOCAL_ENGINE_VERSION,
  })
  return 'tts:' + stableHash(source)
}

export function normalizeTtsText(text) {
  return normalizeText(text)
}

export function getCachedTtsAudioSrc(cacheKey) {
  const cache = readLocalCache()
  const item = cache[cacheKey]
  if (!item || !fileExists(item.savedFilePath)) return ''
  cache[cacheKey] = { ...item, updatedAt: Date.now() }
  writeLocalCache(cache)
  return item.savedFilePath
}

async function saveTtsAudioToDevice(cacheKey, tempFilePath, fileID) {
  if (!cacheKey || !tempFilePath) return tempFilePath || ''
  try {
    const saved = await Taro.saveFile({ tempFilePath })
    const savedFilePath = saved && saved.savedFilePath
    if (!savedFilePath) return tempFilePath
    const cache = readLocalCache()
    cache[cacheKey] = {
      savedFilePath,
      fileID: fileID || '',
      updatedAt: Date.now(),
    }
    writeLocalCache(cache)
    return savedFilePath
  } catch (e) {
    console.warn('[tts] save local audio failed', e)
    return tempFilePath
  }
}

export async function generateLineTts(data) {
  let res
  try {
    res = await Taro.cloud.callFunction({
      name: 'generateLineTts',
      data,
    })
  } catch (e) {
    throw new Error('云函数调用失败：' + (e.errMsg || e.message || e))
  }
  const r = res && res.result
  if (!r || !r.ok) {
    const err = new Error((r && (r.error || r.message)) || '语音生成失败，请稍后再试')
    err.code = r && r.code
    throw err
  }
  return r
}

export async function resolveTtsAudioSrc(result, cacheKey) {
  if (result && result.fileID) {
    try {
      const downloaded = await Taro.cloud.downloadFile({ fileID: result.fileID })
      if (downloaded && downloaded.tempFilePath) {
        return saveTtsAudioToDevice(cacheKey, downloaded.tempFilePath, result.fileID)
      }
    } catch (e) {
      console.warn('[tts] download cloud audio failed', e)
    }
  }
  return (result && (result.tempURL || result.fileID)) || ''
}
