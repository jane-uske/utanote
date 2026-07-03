// Imported songs — persisted with Taro storage (wx.setStorageSync under weapp).

import Taro from '@tarojs/taro'
import { sentences as demoSentences, sampleLyrics } from '../data'

const KEY = 'utanote.library'

export const DEMO_SONG = {
  id: 'demo',
  title: '月灯りのメロディー',
  lyrics: sampleLyrics,
  sentences: demoSentences,
  createdAt: 0,
  demo: true,
}

export function loadSongs() {
  let imported = []
  try {
    const raw = Taro.getStorageSync(KEY)
    if (raw) imported = raw
  } catch {
    imported = []
  }
  if (!Array.isArray(imported)) imported = []
  return [...imported.sort((a, b) => b.createdAt - a.createdAt), DEMO_SONG]
}

function persist(songs) {
  const imported = songs.filter((s) => !s.demo)
  try {
    Taro.setStorageSync(KEY, imported)
  } catch {
    /* ignore */
  }
}

function titleFrom(lyrics) {
  const first = (lyrics || '').split(/\r?\n/).find((l) => l.trim())
  const t = (first || '导入歌词').trim()
  return t.length > 16 ? t.slice(0, 16) + '…' : t
}

export function addSong({ lyrics, sentences, title }) {
  const imported = loadSongs().filter((s) => !s.demo)
  const song = {
    id: 'song-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
    title: title || titleFrom(lyrics),
    lyrics,
    sentences,
    createdAt: Date.now(),
  }
  persist([song, ...imported])
  return { song, songs: loadSongs() }
}

export function deleteSong(id) {
  const remaining = loadSongs().filter((s) => !s.demo && s.id !== id)
  persist(remaining)
  return loadSongs()
}

// ── Mastery tracking ────────────────────────────────────────────
// Storage shape: { "songId:index": "new" | "learning" | "mastered" }

const MASTERY_KEY = 'utanote.mastery'

export function loadMastery() {
  try {
    const raw = Taro.getStorageSync(MASTERY_KEY)
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}

function persistMastery(map) {
  try { Taro.setStorageSync(MASTERY_KEY, map) } catch { /* ignore */ }
}

function masteryKey(songId, index) {
  return songId + ':' + index
}

export function getMastery(map, songId, index) {
  return map[masteryKey(songId, index)] || 'new'
}

export function setMastery(map, songId, index, level) {
  const next = { ...map, [masteryKey(songId, index)]: level }
  persistMastery(next)
  return next
}
