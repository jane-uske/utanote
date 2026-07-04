// Calls the `askLine` cloud function (per-line AI singing coach) and keeps a
// small local answer cache so revisiting a card never re-spends a cloud call.
// The server holds the real invariant (global content-addressed cache, cache
// hits are quota-free); this layer only saves the round-trip.

import Taro from '@tarojs/taro'
import { COPY } from './copy'

const LOCAL_AI_CACHE = 'utanote.ai.answers'
const LOCAL_CACHE_LIMIT = 200

function stableHash(value) {
  const source = String(value || '')
  let hash = 5381
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash) + source.charCodeAt(i)
    hash >>>= 0
  }
  return hash.toString(16)
}

// Mirrors the server key's inputs (question + text + kana). promptVersion
// lives server-side only, so bump this suffix if the answer schema ever
// changes shape enough to break old locally-cached answers.
export function buildAiLocalKey({ questionType, text, kana }) {
  return 'ai:v1:' + stableHash(JSON.stringify({
    questionType,
    text: String(text || '').trim().replace(/\s+/g, ' '),
    kana: String(kana || '').replace(/\s+/g, ''),
  }))
}

function readLocalCache() {
  try {
    const value = Taro.getStorageSync(LOCAL_AI_CACHE)
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
    Taro.setStorageSync(LOCAL_AI_CACHE, next)
  } catch {
    // Local answer cache is a speed optimization only.
  }
}

export function getCachedAiAnswer(localKey) {
  const cache = readLocalCache()
  const item = cache[localKey]
  if (!item || !item.answer) return null
  cache[localKey] = { ...item, updatedAt: Date.now() }
  writeLocalCache(cache)
  return item.answer
}

export function cacheAiAnswer(localKey, answer) {
  if (!localKey || !answer) return
  const cache = readLocalCache()
  cache[localKey] = { answer, updatedAt: Date.now() }
  writeLocalCache(cache)
}

export async function askLineAi({ questionType, text, kana }) {
  let res
  try {
    res = await Taro.cloud.callFunction({
      name: 'askLine',
      data: { questionType, line: { text, kana } },
    })
  } catch (e) {
    throw new Error('云函数调用失败：' + (e.errMsg || e.message || e))
  }
  const r = res && res.result
  if (!r || !r.ok) {
    const err = new Error((r && (r.error || r.message)) || COPY.coachFailed)
    err.code = r && r.code
    throw err
  }
  return r // { ok, answer, cacheHit, quotaConsumed, remainingAskCount, dailyAskLimit }
}

// Toast copy per server error code — mirrors ttsToast's tone: always tell the
// user what still works (cached answers stay viewable after the quota runs
// out). Every code maps to a client-side string from COPY, so server-side
// wording never reaches the UI — that's what keeps review-safe mode airtight.
export function aiErrorMessage(e) {
  const code = e && e.code
  if (code === 'AI_DAILY_LIMIT_EXCEEDED') return COPY.coachQuotaUsedUp
  if (code === 'GLOBAL_AI_LIMIT_EXCEEDED') return COPY.coachBusy
  if (code === 'TEXT_TOO_LONG') return COPY.coachTooLong
  if (code === 'CONTENT_RISK') return COPY.coachContentRisk
  if (code === 'CONTENT_SAFETY_UNAVAILABLE') return '内容安全检查暂不可用，请稍后再试。'
  if (code === 'AI_NOT_CONFIGURED') return COPY.coachNotConfigured
  return COPY.coachFailed
}
