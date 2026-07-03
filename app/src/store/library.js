// Imported songs — persisted in the browser (localStorage). Each song carries
// its parsed `sentences`, so re-opening the app restores the library with no
// backend and no re-parsing.

import { sentences as demoSentences, sampleLyrics } from '../data.js'

const KEY = 'utanote.library'

// The built-in demo song. Always present so the app has content on first run
// and the showcase works with zero configuration.
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
    const raw = localStorage.getItem(KEY)
    if (raw) imported = JSON.parse(raw)
  } catch {
    imported = []
  }
  if (!Array.isArray(imported)) imported = []
  // Newest imported first, demo last.
  return [...imported.sort((a, b) => b.createdAt - a.createdAt), DEMO_SONG]
}

function persist(songs) {
  const imported = songs.filter((s) => !s.demo)
  try {
    localStorage.setItem(KEY, JSON.stringify(imported))
  } catch {
    /* ignore quota errors */
  }
}

function titleFrom(lyrics) {
  const first = (lyrics || '').split(/\r?\n/).find((l) => l.trim())
  const t = (first || '导入歌词').trim()
  return t.length > 16 ? t.slice(0, 16) + '…' : t
}

// Add a freshly parsed song and return the updated, ordered list.
export function addSong({ lyrics, sentences, title }) {
  const songs = loadSongs()
  const song = {
    id: 'song-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
    title: title || titleFrom(lyrics),
    lyrics,
    sentences,
    createdAt: Date.now(),
  }
  const imported = songs.filter((s) => !s.demo)
  persist([song, ...imported])
  return { song, songs: loadSongs() }
}
