// Consecutive-study-days tracking — persisted with Taro storage.
// Storage shape: { last: 'YYYY-MM-DD', streak: number }

import Taro from '@tarojs/taro'

const KEY = 'utanote.streak'

function dateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function todayStr() { return dateStr(new Date()) }
function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return dateStr(d)
}

function load() {
  try {
    const raw = Taro.getStorageSync(KEY)
    if (raw && typeof raw === 'object' && typeof raw.last === 'string') return raw
  } catch { /* fall through */ }
  return { last: '', streak: 0 }
}

// Streak for display. The stored chain only counts if it reaches today or
// yesterday — otherwise it's broken and shows 0 until the next study action.
export function currentStreak() {
  const s = load()
  if (s.last === todayStr() || s.last === yesterdayStr()) return s.streak
  return 0
}

// Record a study action today and return the updated streak.
export function recordStudy() {
  const s = load()
  const today = todayStr()
  let streak
  if (s.last === today) streak = s.streak || 1
  else if (s.last === yesterdayStr()) streak = (s.streak || 0) + 1
  else streak = 1
  try { Taro.setStorageSync(KEY, { last: today, streak }) } catch { /* ignore */ }
  return streak
}
