import { useRef, useState } from 'react'
import { sampleLyrics } from './data.js'
import { loadSongs, addSong } from './store/library.js'
import { loadSettings, saveSettings, hasApiKey } from './config/settings.js'
import { parseLyrics } from './parseLyrics.js'

// ─────────────────────────────────────────────────────────────
// UtaNote logic layer — DOM-agnostic.
//
// Owns all state, derived values, and actions (including the async
// lyrics-parsing pipeline and AI-settings). Returns plain data + callbacks and
// touches no JSX / DOM APIs, so it ports to Taro (mini-program + H5) unchanged.
// ─────────────────────────────────────────────────────────────

function splitSentence(s) {
  if (!s.highlightWord) return { pre: s.original, word: '', post: '' }
  const idx = s.original.indexOf(s.highlightWord)
  if (idx < 0) return { pre: s.original, word: '', post: '' }
  return {
    pre: s.original.slice(0, idx),
    word: s.highlightWord,
    post: s.original.slice(idx + s.highlightWord.length),
  }
}

const MASTERY_BY_STATUS = { 新学: 'learning', 待学习: 'new' }
const MASTERY_LABEL = { mastered: '已掌握', learning: '学习中', new: '未学习' }
const MASTERY_COLOR = { mastered: '#8ed6a8', learning: '#e8c468', new: 'rgba(255,255,255,0.4)' }

export function useUtaNote() {
  const [activeTab, setActiveTab] = useState('home')
  const [studyPhase, setStudyPhase] = useState('tasks')
  const [cardIndex, setCardIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [modalDetail, setModalDetail] = useState(null)
  const [romajiOpen, setRomajiOpen] = useState(false)
  const [favorites, setFavorites] = useState({})
  const [lyricsText, setLyricsText] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const [libraryFilter, setLibraryFilter] = useState('all')
  const [librarySearch, setLibrarySearch] = useState('')

  // Library + active song
  const [songs, setSongs] = useState(() => loadSongs())
  const [activeSongId, setActiveSongId] = useState(() => loadSongs()[0]?.id)

  // AI parsing settings + status
  const [settings, setSettings] = useState(() => loadSettings())
  const [settingsDraft, setSettingsDraft] = useState(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [parseNotice, setParseNotice] = useState('')
  const playRef = useRef(null)

  const activeSong = songs.find((s) => s.id === activeSongId) || songs[0]
  const sentences = activeSong ? activeSong.sentences : []
  const total = sentences.length
  const safeIndex = Math.min(cardIndex, Math.max(0, total - 1))
  const current = sentences[safeIndex] || sentences[0]

  // ── actions ───────────────────────────────────────────────
  const setTab = (tab) => { setActiveTab(tab); setStudyPhase('tasks') }
  const goHome = () => setActiveTab('home')
  const fillSample = () => setLyricsText(sampleLyrics)
  const openCard = (i) => {
    setActiveTab('study'); setStudyPhase('card'); setCardIndex(i)
    setRomajiOpen(false); setShowModal(false)
  }
  const startPractice = () => openCard(0)
  const backToTasks = () => setStudyPhase('tasks')
  const prevCard = () => {
    setCardIndex((i) => Math.max(0, i - 1))
    setRomajiOpen(false); setShowModal(false)
  }
  const nextCard = () => {
    if (safeIndex >= total - 1) { setStudyPhase('summary'); return }
    setCardIndex(safeIndex + 1)
    setRomajiOpen(false); setShowModal(false)
  }
  const toggleRomaji = () => setRomajiOpen((v) => !v)
  const openWordModal = (detail) => { setModalDetail(detail); setShowModal(true) }
  const closeWordModal = () => setShowModal(false)
  const setLyrics = (text) => setLyricsText(text)
  const setSearch = (text) => setLibrarySearch(text)
  const toggleFavorite = () => {
    const word = modalDetail && modalDetail.word
    if (!word) return
    setFavorites((f) => ({ ...f, [word]: !f[word] }))
  }
  const togglePlay = () => {
    const id = 'x' + Math.random()
    setPlayingId(id)
    if (playRef.current) clearTimeout(playRef.current)
    playRef.current = setTimeout(() => {
      setPlayingId((cur) => (cur === id ? null : cur))
    }, 700)
  }

  const openSongTasks = (id) => {
    setActiveSongId(id); setCardIndex(0)
    setActiveTab('study'); setStudyPhase('tasks')
  }

  // Parse the pasted lyrics (hybrid local + LLM) and open the new song.
  const startBreakdown = async () => {
    if (parsing) return
    setParseError('')
    setParseNotice('')
    setParsing(true)
    try {
      const { sentences: parsed, truncated, source } = await parseLyrics(lyricsText, settings)
      const { song, songs: next } = addSong({ lyrics: lyricsText, sentences: parsed })
      setSongs(next)
      setActiveSongId(song.id)
      setCardIndex(0)
      setActiveTab('study')
      setStudyPhase('tasks')
      if (source === 'local') {
        setParseNotice('未配置 AI 解析，已生成本地分词草稿（读音/释义为占位）。到「我的 → AI 解析设置」填入 Key 可自动生成完整内容。')
      } else if (truncated) {
        setParseNotice('歌词较长，本次仅解析了前 40 行。')
      }
    } catch (e) {
      setParseError(e.message || '解析失败，请重试。')
    } finally {
      setParsing(false)
    }
  }
  const dismissParseError = () => setParseError('')
  const dismissParseNotice = () => setParseNotice('')

  // Settings
  const openSettings = () => { setSettingsDraft({ ...settings }); setSettingsOpen(true) }
  const closeSettings = () => setSettingsOpen(false)
  const updateSettingsDraft = (patch) => setSettingsDraft((d) => ({ ...d, ...patch }))
  const saveSettingsAction = () => {
    const clean = saveSettings(settingsDraft)
    setSettings(clean)
    setSettingsOpen(false)
  }

  // ── derived values ────────────────────────────────────────
  const isHome = activeTab === 'home' && !settingsOpen
  const isTasks = activeTab === 'study' && studyPhase === 'tasks' && !settingsOpen
  const isCard = activeTab === 'study' && studyPhase === 'card' && !settingsOpen
  const isSummary = activeTab === 'study' && studyPhase === 'summary' && !settingsOpen
  const isLibrary = activeTab === 'library' && !settingsOpen
  const isMe = activeTab === 'me' && !settingsOpen
  const isSettings = settingsOpen
  const showTabBar = !isCard && !isSettings

  const playGlyph = playingId ? '❚❚' : '▶'
  const playIconColor = playingId ? '#a5a8ec' : 'rgba(255,255,255,0.5)'

  const tabs = [
    { key: 'home', label: '首页', icon: '⌂' },
    { key: 'study', label: '学习', icon: '♪' },
    { key: 'library', label: '词库', icon: '▤' },
    { key: 'me', label: '我的', icon: '◯' },
  ].map((t) => ({
    ...t,
    color: activeTab === t.key && !settingsOpen ? '#a5a8ec' : 'rgba(255,255,255,0.4)',
    onClick: () => { setSettingsOpen(false); setTab(t.key) },
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
  ].map((d) => ({
    label: d.label,
    bg: d.done ? '#6b70cf' : 'rgba(255,255,255,0.06)',
    mark: d.done ? '✓' : '',
  }))

  const summaryStats = [
    { value: '12 句', label: '本周新学句子', delta: '+8' },
    { value: '38 个', label: '掌握词汇', delta: '+21' },
    { value: '2h45m', label: '学习时长', delta: '+1.2h' },
  ]

  const vocabAll = sentences.map((row, i) => {
    let mastery = MASTERY_BY_STATUS[row.status] || 'new'
    if (i === 0) mastery = 'mastered'
    return {
      word: row.detail.word, kana: row.detail.kana, meaning: row.detail.meaning,
      pos: row.detail.pos, song: activeSong?.title || '', mastery, detail: row.detail,
    }
  })
  const q = librarySearch.trim()
  const filteredVocab = vocabAll
    .filter((v) => libraryFilter === 'all' || v.mastery === libraryFilter)
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

  const detail = modalDetail || current?.detail || {}
  const isFav = !!favorites[detail.word]

  const tokenViews = (current?.tokens || []).map((tok, i) => ({
    key: i,
    text: tok.text,
    reading: tok.reading,
    role: tok.role,
    bg: tok.type === 'particle' ? 'transparent' : 'rgba(255,255,255,0.05)',
    border: tok.type === 'particle' ? '1px dashed rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)',
    color: tok.type === 'particle' ? 'rgba(255,255,255,0.55)' : '#eceaf3',
    weight: tok.type === 'particle' ? 400 : 600,
  }))

  const mySongs = songs.map((s) => ({
    key: s.id,
    title: s.title,
    subtitle: `共 ${s.sentences.length} 句${s.demo ? ' · 示例' : ''}`,
    onClick: () => openSongTasks(s.id),
  }))

  return {
    // screen flags
    isHome, isTasks, isCard, isSummary, isLibrary, isMe, isSettings, showTabBar, showModal,

    // home / import
    lyricsText,
    lyricsCount: lyricsText.length,
    setLyrics,
    fillSample,
    startBreakdown,
    parsing,
    parseError,
    parseNotice,
    dismissParseError,
    dismissParseNotice,
    hasApiKey: hasApiKey(settings),

    // nav
    tabs,

    // tasks
    songTitle: activeSong?.title || '',
    sentenceCount: total,
    taskRows,
    startPractice,

    // card
    currentSentence: current || {},
    currentSplit: current ? splitSentence(current) : { pre: '', word: '', post: '' },
    tokenViews,
    cardPositionLabel: `${safeIndex + 1} / ${total}`,
    cardProgressPct: total ? Math.round(((safeIndex + 1) / total) * 100) : 0,
    romajiOpen,
    romajiToggleLabel: romajiOpen ? '收起假名/罗马音' : '显示假名/罗马音',
    romajiArrowRotate: romajiOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    toggleRomaji,
    openWordModal,
    backToTasks,
    prevCard,
    nextCard,
    prevOpacity: safeIndex === 0 ? 0.4 : 1,
    nextLabel: safeIndex >= total - 1 ? '完成' : '下一句',

    // playback
    togglePlay,
    playGlyph,
    playIconColor,

    // summary
    weekDays,
    summaryStats,
    goHome,

    // library
    librarySearch,
    setSearch,
    libraryFilterChips,
    libraryStats,
    filteredVocab,

    // me
    mySongs,
    importedCount: songs.filter((s) => !s.demo).length,
    openSettings,

    // settings
    settingsDraft,
    updateSettingsDraft,
    saveSettingsAction,
    closeSettings,

    // word modal
    currentDetail: detail,
    favoriteGlyph: isFav ? '★' : '☆',
    favoriteColor: isFav ? '#e8c468' : 'rgba(255,255,255,0.4)',
    toggleFavorite,
    closeWordModal,
  }
}
