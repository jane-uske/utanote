import { useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { sampleLyrics } from '../data'
import { loadSongs, addSong, deleteSong, loadMastery, getMastery, setMastery } from './library'
import { parseLyrics } from './parse'
import { initFontScale, getFontScale, setFontScale as _setFontScale } from './sx'

// UtaNote logic layer — identical shape to the web app's hook, but parsing goes
// through the `parse` cloud function and persistence uses Taro storage.

function splitSentence(s) {
  if (!s || !s.highlightWord) return { pre: s ? s.original : '', word: '', post: '' }
  const idx = s.original.indexOf(s.highlightWord)
  if (idx < 0) return { pre: s.original, word: '', post: '' }
  return {
    pre: s.original.slice(0, idx),
    word: s.highlightWord,
    post: s.original.slice(idx + s.highlightWord.length),
  }
}

const MASTERY_LABEL = { mastered: '已掌握', learning: '学习中', new: '未学习' }
const MASTERY_COLOR = { mastered: '#8ed6a8', learning: '#e8c468', new: 'rgba(255,255,255,0.4)' }

const FONT_SCALE_OPTIONS = [
  { key: 0.9, label: '小' },
  { key: 1, label: '标准' },
  { key: 1.15, label: '大' },
  { key: 1.3, label: '超大' },
]

// Initialize font scale from storage before first render.
initFontScale()

const FAV_KEY = 'utanote.favorites'

function loadFavorites() {
  try {
    const raw = Taro.getStorageSync(FAV_KEY)
    return raw && typeof raw === 'object' ? raw : {}
  } catch { return {} }
}
function persistFavorites(fav) {
  try { Taro.setStorageSync(FAV_KEY, fav) } catch { /* ignore */ }
}

export function useUtaNote() {
  const [activeTab, setActiveTab] = useState('home')
  const [studyPhase, setStudyPhase] = useState('tasks')
  const [cardIndex, setCardIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [modalDetail, setModalDetail] = useState(null)
  const [romajiOpen, setRomajiOpen] = useState(false)
  const [favorites, setFavorites] = useState(() => loadFavorites())
  const [lyricsText, setLyricsText] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const [libraryFilter, setLibraryFilter] = useState('all')
  const [librarySearch, setLibrarySearch] = useState('')

  const [songs, setSongs] = useState(() => loadSongs())
  const [activeSongId, setActiveSongId] = useState(() => loadSongs()[0] && loadSongs()[0].id)
  const [masteryMap, setMasteryMap] = useState(() => loadMastery())
  const [fontScale, setFontScaleState] = useState(() => getFontScale())

  const [parsing, setParsing] = useState(false)
  const [parseStage, setParseStage] = useState('')
  const [parseElapsed, setParseElapsed] = useState(0)
  const [parseError, setParseError] = useState('')
  const [parseNotice, setParseNotice] = useState('')
  const playRef = useRef(null)
  const parseTimerRef = useRef(null)

  const activeSong = songs.find((s) => s.id === activeSongId) || songs[0]
  const sentences = activeSong ? activeSong.sentences : []
  const total = sentences.length
  const safeIndex = Math.min(cardIndex, Math.max(0, total - 1))
  const current = sentences[safeIndex] || sentences[0]

  const setTab = (tab) => { setActiveTab(tab); setStudyPhase('tasks') }
  const goHome = () => setActiveTab('home')
  const fillSample = () => setLyricsText(sampleLyrics)
  const openCard = (i) => {
    setActiveTab('study'); setStudyPhase('card'); setCardIndex(i)
    setRomajiOpen(false); setShowModal(false)
    // Auto-promote "new" → "learning" when the card is first viewed.
    if (activeSongId && getMastery(masteryMap, activeSongId, i) === 'new') {
      setMasteryMap((m) => setMastery(m, activeSongId, i, 'learning'))
    }
  }
  const markAsMastered = (i) => {
    if (!activeSongId) return
    setMasteryMap((m) => setMastery(m, activeSongId, i, 'mastered'))
  }
  const startPractice = () => openCard(0)
  const backToTasks = () => setStudyPhase('tasks')
  const prevCard = () => { setCardIndex((i) => Math.max(0, i - 1)); setRomajiOpen(false); setShowModal(false) }
  const nextCard = () => {
    if (safeIndex >= total - 1) { setStudyPhase('summary'); return }
    setCardIndex(safeIndex + 1); setRomajiOpen(false); setShowModal(false)
  }
  const toggleRomaji = () => setRomajiOpen((v) => !v)
  const openWordModal = (detail) => { setModalDetail(detail); setShowModal(true) }
  const closeWordModal = () => setShowModal(false)
  const setLyrics = (text) => setLyricsText(text)
  const setSearch = (text) => setLibrarySearch(text)
  const toggleFavorite = () => {
    const word = modalDetail && modalDetail.word
    if (!word) return
    setFavorites((f) => {
      const next = { ...f, [word]: !f[word] }
      persistFavorites(next)
      return next
    })
  }
  const togglePlay = () => {
    const id = 'x' + Math.random()
    setPlayingId(id)
    if (playRef.current) clearTimeout(playRef.current)
    playRef.current = setTimeout(() => setPlayingId((cur) => (cur === id ? null : cur)), 700)
  }
  const openSongTasks = (id) => {
    setActiveSongId(id); setCardIndex(0); setActiveTab('study'); setStudyPhase('tasks')
  }

  const removeSong = (id) => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后歌曲和学习记录将无法恢复',
      confirmColor: '#e05050',
      success: (res) => {
        if (res.confirm) {
          const next = deleteSong(id)
          setSongs(next)
          if (activeSongId === id) {
            setActiveSongId(next[0] ? next[0].id : null)
            setActiveTab('home')
          }
        }
      },
    })
  }

  const startBreakdown = async () => {
    if (parsing) return
    setParseError(''); setParseNotice(''); setParsing(true)
    setParseStage('正在连接云函数…'); setParseElapsed(0)

    // Elapsed‐time ticker — counts up each second so the user sees movement.
    const t0 = Date.now()
    parseTimerRef.current = setInterval(() => {
      setParseElapsed(Math.floor((Date.now() - t0) / 1000))
    }, 1000)

    try {
      const lineCount = (lyricsText || '').split(/\r?\n/).filter((l) => l.trim()).length
      setParseStage(`正在解析 ${lineCount} 行歌词…`)
      const r = await parseLyrics(lyricsText)
      setParseStage('解析完成，正在生成卡片…')
      const { song, songs: next } = addSong({ lyrics: lyricsText, sentences: r.sentences, title: songTitle.trim() || undefined })
      setSongs(next); setActiveSongId(song.id); setCardIndex(0)
      setActiveTab('study'); setStudyPhase('tasks')
      setSongTitle('')
      if (r.warning) setParseNotice(r.warning)
      else if (r.source === 'local') setParseNotice('未配置 AI 解析，已生成本地分词草稿（读音/释义为占位）。在云函数配置 DEEPSEEK_KEY 后可自动生成完整内容。')
      else if (r.truncated) setParseNotice('歌词较长，本次仅解析了前 40 行。')
    } catch (e) {
      setParseError(e.message || '解析失败，请重试。')
    } finally {
      clearInterval(parseTimerRef.current)
      setParsing(false); setParseStage(''); setParseElapsed(0)
    }
  }
  const dismissParseError = () => setParseError('')
  const dismissParseNotice = () => setParseNotice('')

  const [aboutOpen, setAboutOpen] = useState(false)
  const openAbout = () => setAboutOpen(true)
  const closeAbout = () => setAboutOpen(false)

  const isHome = activeTab === 'home' && !aboutOpen
  const isTasks = activeTab === 'study' && studyPhase === 'tasks' && !aboutOpen
  const isCard = activeTab === 'study' && studyPhase === 'card' && !aboutOpen
  const isSummary = activeTab === 'study' && studyPhase === 'summary' && !aboutOpen
  const isLibrary = activeTab === 'library' && !aboutOpen
  const isMe = activeTab === 'me' && !aboutOpen
  const isAbout = aboutOpen
  const showTabBar = !isCard && !isAbout

  const playGlyph = playingId ? '❚❚' : '▶'
  const playIconColor = playingId ? '#a5a8ec' : 'rgba(255,255,255,0.5)'

  const tabs = [
    { key: 'home', label: '首页', icon: '⌂' },
    { key: 'study', label: '学习', icon: '♪' },
    { key: 'library', label: '词库', icon: '▤' },
    { key: 'me', label: '我的', icon: '◯' },
  ].map((t) => ({
    ...t,
    color: activeTab === t.key && !aboutOpen ? '#a5a8ec' : 'rgba(255,255,255,0.4)',
    onClick: () => { setAboutOpen(false); setTab(t.key) },
  }))

  const taskRows = sentences.map((row, i) => ({
    key: row.label + '-' + i,
    label: row.label,
    text: row.original,
    status: row.status,
    badgeBg: row.status === '新学' ? 'rgba(165,168,236,0.15)' : 'rgba(255,255,255,0.06)',
    badgeColor: row.status === '新学' ? '#a5a8ec' : 'rgba(255,255,255,0.4)',
    borderColor: i === 0 ? 'rgba(165,168,236,0.45)' : 'rgba(255,255,255,0.06)',
    onClick: () => openCard(i),
  }))

  const weekDays = [
    { label: '一', done: true }, { label: '二', done: true }, { label: '三', done: true },
    { label: '四', done: true }, { label: '五', done: false }, { label: '六', done: false }, { label: '日', done: false },
  ].map((d) => ({ label: d.label, bg: d.done ? '#6b70cf' : 'rgba(255,255,255,0.06)', mark: d.done ? '✓' : '' }))

  const summaryStats = [
    { value: '12 句', label: '本周新学句子', delta: '+8' },
    { value: '38 个', label: '掌握词汇', delta: '+21' },
    { value: '2h45m', label: '学习时长', delta: '+1.2h' },
  ]

  const vocabAll = sentences.map((row, i) => {
    const mastery = activeSongId ? getMastery(masteryMap, activeSongId, i) : 'new'
    return {
      word: row.detail.word, kana: row.detail.kana, meaning: row.detail.meaning,
      pos: row.detail.pos, song: activeSong ? activeSong.title : '', mastery, detail: row.detail,
    }
  })
  const q = librarySearch.trim()
  const filteredVocab = vocabAll
    .filter((v) => libraryFilter === 'all' ? true : libraryFilter === 'favorites' ? !!favorites[v.word] : v.mastery === libraryFilter)
    .filter((v) => !q || v.word.includes(q) || (v.meaning || '').includes(q) || (v.kana || '').includes(q))
    .map((v, i) => ({
      ...v,
      key: v.word + '-' + i,
      statusLabel: MASTERY_LABEL[v.mastery],
      statusColor: MASTERY_COLOR[v.mastery],
      onClick: () => openWordModal(v.detail),
    }))
  const libraryFilterChips = [
    { key: 'all', label: '全部' },
    { key: 'favorites', label: '★ 收藏' },
    { key: 'mastered', label: '已掌握' },
    { key: 'learning', label: '学习中' },
    { key: 'new', label: '未学习' },
  ].map((f) => {
    const active = libraryFilter === f.key
    return {
      ...f,
      bg: active ? 'rgba(165,168,236,0.18)' : 'rgba(255,255,255,0.04)',
      color: active ? '#a5a8ec' : 'rgba(255,255,255,0.5)',
      border: active ? '1px solid rgba(165,168,236,0.4)' : '1px solid rgba(255,255,255,0.07)',
      onClick: () => setLibraryFilter(f.key),
    }
  })
  const libraryStats = {
    total: vocabAll.length,
    mastered: vocabAll.filter((v) => v.mastery === 'mastered').length,
    learning: vocabAll.filter((v) => v.mastery === 'learning').length,
  }

  const detail = modalDetail || (current && current.detail) || {}
  const isFav = !!favorites[detail.word]

  const tokenViews = ((current && current.tokens) || []).map((tok, i) => ({
    key: i,
    text: tok.text,
    reading: tok.reading,
    role: tok.role,
    bg: tok.type === 'particle' ? 'transparent' : 'rgba(255,255,255,0.05)',
    border: tok.type === 'particle' ? '1px dashed rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
    color: tok.type === 'particle' ? 'rgba(255,255,255,0.55)' : '#eceaf3',
    weight: tok.type === 'particle' ? 400 : 600,
  }))

  const AVATAR_HUES = [260, 210, 180, 340, 30, 150, 290, 50, 120, 320]
  const mySongs = songs.map((s, i) => {
    const char = (s.title || '歌')[0]
    const hue = AVATAR_HUES[i % AVATAR_HUES.length]
    return {
      key: s.id,
      title: s.title,
      subtitle: `共 ${s.sentences.length} 句${s.demo ? ' · 示例' : ''}`,
      demo: !!s.demo,
      avatarChar: char,
      avatarBg: `linear-gradient(135deg, hsl(${hue}, 45%, 38%), hsl(${hue}, 35%, 22%))`,
      onClick: () => openSongTasks(s.id),
      onDelete: s.demo ? null : () => removeSong(s.id),
    }
  })

  const currentMastery = activeSongId ? getMastery(masteryMap, activeSongId, safeIndex) : 'new'

  const setFontScaleAction = (scale) => {
    _setFontScale(scale)
    setFontScaleState(scale)
  }
  const fontScaleLabel = (FONT_SCALE_OPTIONS.find((o) => o.key === fontScale) || FONT_SCALE_OPTIONS[1]).label

  return {
    isHome, isTasks, isCard, isSummary, isLibrary, isMe, isAbout, showTabBar, showModal,
    lyricsText, lyricsCount: lyricsText.length, setLyrics, fillSample, startBreakdown,
    songTitle, setSongTitle,
    parsing, parseStage, parseElapsed, parseError, parseNotice, dismissParseError, dismissParseNotice,
    tabs,
    activeSongTitle: activeSong ? activeSong.title : '', sentenceCount: total, taskRows, startPractice,
    currentSentence: current || {},
    currentSplit: current ? splitSentence(current) : { pre: '', word: '', post: '' },
    tokenViews,
    cardPositionLabel: `${safeIndex + 1} / ${total}`,
    cardProgressPct: total ? Math.round(((safeIndex + 1) / total) * 100) : 0,
    romajiOpen,
    romajiToggleLabel: romajiOpen ? '收起假名/罗马音' : '显示假名/罗马音',
    romajiArrowRotate: romajiOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    toggleRomaji, openWordModal, backToTasks, prevCard, nextCard,
    prevOpacity: safeIndex === 0 ? 0.4 : 1,
    nextLabel: safeIndex >= total - 1 ? '完成' : '下一句',
    togglePlay, playGlyph, playIconColor,
    weekDays, summaryStats, goHome,
    librarySearch, setSearch, libraryFilterChips, libraryStats, filteredVocab,
    mySongs, importedCount: songs.filter((s) => !s.demo).length,
    currentDetail: detail,
    favoriteGlyph: isFav ? '★' : '☆',
    favoriteColor: isFav ? '#e8c468' : 'rgba(255,255,255,0.4)',
    toggleFavorite, closeWordModal,
    currentMastery,
    currentMasteryLabel: MASTERY_LABEL[currentMastery],
    currentMasteryColor: MASTERY_COLOR[currentMastery],
    markAsMastered: () => markAsMastered(safeIndex),
    fontScale, fontScaleLabel, fontScaleOptions: FONT_SCALE_OPTIONS, setFontScaleAction,
    openAbout, closeAbout,
  }
}
