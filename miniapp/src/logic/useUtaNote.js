import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { sampleLyrics } from '../data'
import { loadSongs, addSong, deleteSong, loadMastery, getMastery, setMastery } from './library'
import { currentStreak, recordStudy } from './streak'
import { parseLyrics, looksJapanese } from './parse'
import { buildTtsLocalCacheKey, ensureTtsAsset, getCachedTtsAudioSrc, normalizeTtsText, resolveTtsAudioSrc, resolveTokenAudioText } from './tts'
import { initFontScale, getFontScale, setFontScale as _setFontScale } from './sx'
import { findEasterEgg, TAP_EGG_MESSAGE, TAP_EGG_THRESHOLD, TAP_EGG_COOLDOWN_MS } from './eastereggs'

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
const MASTERY_COLOR = { mastered: 'var(--success)', learning: 'var(--warning)', new: 'var(--ink-4)' }
// Pre-composed translucent border variants — var(--x) can't take a hex-style
// alpha suffix (unlike a literal hex color), so these are separate tokens.
const MASTERY_BORDER = { mastered: 'var(--success-soft)', learning: 'var(--warning-soft)', new: 'var(--ink-2)' }

const FONT_SCALE_OPTIONS = [
  { key: 0.9, label: '小' },
  { key: 1, label: '标准' },
  { key: 1.15, label: '大' },
  { key: 1.3, label: '超大' },
]

const TTS_VOICE_KEY = 'utanote.tts.voice'
const TTS_VOICE_OPTIONS = [
  { key: 'voicevox_sora_normal', label: '柔和' },
  { key: 'voicevox_metan_normal', label: '女声' },
  { key: 'voicevox_tsumugi_normal', label: '明亮' },
  { key: 'voicevox_zundamon_normal', label: '活泼' },
  { key: 'voicevox_no7_reading', label: '朗读' },
]
function loadTtsVoice() {
  try {
    const value = Taro.getStorageSync(TTS_VOICE_KEY)
    return TTS_VOICE_OPTIONS.some((o) => o.key === value) ? value : TTS_VOICE_OPTIONS[0].key
  } catch {
    return TTS_VOICE_OPTIONS[0].key
  }
}
function saveTtsVoice(value) {
  try { Taro.setStorageSync(TTS_VOICE_KEY, value) } catch { /* ignore */ }
}

// Initialize font scale from storage before first render.
initFontScale()

// Must match MAX_CHARS in cloudfunctions/parse (and the Textarea maxlength).
const MAX_LYRICS_CHARS = 5000

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

// System light/dark mode. Falls back to dark (the app's original design)
// if the base library doesn't report a theme.
function getSystemTheme() {
  try {
    return Taro.getSystemInfoSync().theme === 'light' ? 'light' : 'dark'
  } catch { return 'dark' }
}

// navigationStyle:'custom' means there's no native nav bar to align to, so any
// custom header row has to be measured against the capsule (胶囊按钮) by hand.
// navBarHeight mirrors the standard WeChat recipe — doubling the gap between
// the status bar and the capsule's top gives a bar whose vertical center lines
// up with the capsule's, regardless of device/notch height.
function getNavMetrics() {
  try {
    const capsule = Taro.getMenuButtonBoundingClientRect()
    const sys = Taro.getSystemInfoSync()
    const statusBarHeight = sys.statusBarHeight || 20
    const navBarHeight = (capsule.top - statusBarHeight) * 2 + capsule.height
    const windowWidth = sys.windowWidth || sys.screenWidth || 375
    return {
      navBarPaddingTop: statusBarHeight,
      navBarHeight,
      navBarRightReserve: windowWidth - capsule.left + 8,
      capsuleBottom: capsule.top + capsule.height,
    }
  } catch {
    return { navBarPaddingTop: 20, navBarHeight: 32, navBarRightReserve: 96, capsuleBottom: 60 }
  }
}

export function useUtaNote() {
  const [activeTab, setActiveTab] = useState('home')
  const [studyPhase, setStudyPhase] = useState('tasks')
  const [cardIndex, setCardIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [modalClosing, setModalClosing] = useState(false)
  const [modalDetail, setModalDetail] = useState(null)
  const [streakDays, setStreakDays] = useState(() => currentStreak())
  const [romajiOpen, setRomajiOpen] = useState(false)
  const [navDir, setNavDir] = useState('next')
  const [themeMode, setThemeMode] = useState(() => getSystemTheme())
  const [favorites, setFavorites] = useState(() => loadFavorites())
  const [lyricsText, setLyricsText] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [ttsLoadingId, setTtsLoadingId] = useState(null)
  const [playingTtsId, setPlayingTtsId] = useState(null)
  const [ttsSlow, setTtsSlow] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState('all')
  const [librarySearch, setLibrarySearch] = useState('')

  const [songs, setSongs] = useState(() => loadSongs())
  const [activeSongId, setActiveSongId] = useState(() => loadSongs()[0] && loadSongs()[0].id)
  const [masteryMap, setMasteryMap] = useState(() => loadMastery())
  const [fontScale, setFontScaleState] = useState(() => getFontScale())
  const [ttsVoice, setTtsVoiceState] = useState(() => loadTtsVoice())
  const [navMetrics] = useState(() => getNavMetrics())

  const [parsing, setParsing] = useState(false)
  const [parseStage, setParseStage] = useState('')
  const [parseElapsed, setParseElapsed] = useState(0)
  const [parseError, setParseError] = useState('')
  const [parseNotice, setParseNotice] = useState('')
  const [eggOpen, setEggOpen] = useState(false)
  const [eggFlash, setEggFlash] = useState('')
  const eggTapRef = useRef({ count: 0, coolUntil: 0 })
  const eggFlashTimerRef = useRef(null)
  const audioRef = useRef(null)
  const parseTimerRef = useRef(null)
  const modalTimerRef = useRef(null)

  // Live-follow system theme changes (e.g. user flips iOS/Android dark mode
  // while the mini program is open). onThemeChange isn't on every base
  // library version, so this is best-effort — initial read still works.
  useEffect(() => {
    if (typeof Taro.onThemeChange !== 'function') return
    const handler = (res) => setThemeMode(res && res.theme === 'light' ? 'light' : 'dark')
    Taro.onThemeChange(handler)
    return () => {
      if (typeof Taro.offThemeChange === 'function') Taro.offThemeChange(handler)
    }
  }, [])

  // navigationStyle:'custom' means WeChat doesn't auto-apply theme.json's
  // navigationBarTextStyle to the system status bar (time/battery/signal),
  // so it has to be set by hand — otherwise those icons stay whichever
  // color they started in and can go invisible against the flipped bg.
  useEffect(() => {
    const backgroundColor = themeMode === 'light' ? '#f4f4f8' : '#0d1120'
    try {
      if (typeof Taro.setNavigationBarColor === 'function') {
        Taro.setNavigationBarColor({
          frontColor: themeMode === 'light' ? '#000000' : '#ffffff',
          backgroundColor,
        })
      }
      if (typeof Taro.setBackgroundColor === 'function') {
        Taro.setBackgroundColor({
          backgroundColor,
          backgroundColorTop: backgroundColor,
          backgroundColorBottom: backgroundColor,
        })
      }
    } catch { /* not fatal — custom-drawn UI still reflects the theme */ }
  }, [themeMode])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.destroy() } catch { /* ignore */ }
        audioRef.current = null
      }
      if (parseTimerRef.current) clearInterval(parseTimerRef.current)
      if (modalTimerRef.current) clearTimeout(modalTimerRef.current)
      if (eggFlashTimerRef.current) clearTimeout(eggFlashTimerRef.current)
    }
  }, [])

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
    setStreakDays(recordStudy())
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
  // navDir drives which edge the next card slides in from (index.css
  // .card-in-next/.card-in-prev) — kept in sync for both button taps and swipes,
  // since swipe gestures call these same functions.
  const prevCard = () => {
    setNavDir('prev'); setCardIndex((i) => Math.max(0, i - 1)); setRomajiOpen(false); setShowModal(false)
  }
  const nextCard = () => {
    setNavDir('next')
    if (safeIndex >= total - 1) { setStudyPhase('summary'); return }
    setCardIndex(safeIndex + 1); setRomajiOpen(false); setShowModal(false)
  }
  const toggleRomaji = () => setRomajiOpen((v) => !v)
  const openWordModal = (detail) => {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current)
    setModalClosing(false); setModalDetail(detail); setShowModal(true); setEggOpen(false)
  }
  // Play the sheet's exit animation, then unmount (duration matches
  // .modal-sheet.closing in index.css).
  const closeWordModal = () => {
    if (!showModal || modalClosing) return
    setModalClosing(true)
    modalTimerRef.current = setTimeout(() => {
      setShowModal(false); setModalClosing(false)
    }, 240)
  }
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
  const stopTts = () => {
    if (audioRef.current) {
      try { audioRef.current.stop() } catch { /* ignore */ }
    }
    setPlayingTtsId(null)
  }
  const ttsToast = (e) => {
    const code = e && e.code
    let msg
    if (code === 'TEXT_TOO_LONG') {
      msg = '这句歌词太长了，暂不支持朗读'
    } else if (code === 'DAILY_LIMIT' || code === 'DAILY_USER_ASSET_LIMIT_EXCEEDED' || code === 'DAILY_CUSTOM_TEXT_LIMIT_EXCEEDED') {
      msg = '今日可生成的学习音频额度已用完，已生成的内容仍可继续播放。'
    } else if (code === 'GLOBAL_TTS_LIMIT_EXCEEDED') {
      msg = '今日语音生成较多，请稍后再试，已生成的内容仍可继续播放。'
    } else if (code === 'TTS_BUSY') {
      msg = '语音生成繁忙，请稍后再试'
    } else {
      msg = '语音播放失败，请重试'
    }
    Taro.showToast({ title: msg, icon: 'none', duration: 2500 })
  }
  const currentLineId = () => current ? String(current.label || current.num || safeIndex + 1) : ''
  const currentTtsBaseId = () => current ? `line-${currentLineId()}` : ''
  const playTtsSrc = (id, src) => {
    if (typeof Taro.setInnerAudioOption === 'function') {
      try {
        Taro.setInnerAudioOption({
          obeyMuteSwitch: false,
          mixWithOther: true,
        })
      } catch (e) {
        console.warn('[tts] set inner audio option failed', e)
      }
    }
    const audio = Taro.createInnerAudioContext()
    if (audioRef.current) {
      try { audioRef.current.destroy() } catch { /* ignore */ }
    }
    audioRef.current = audio
    audio.src = src
    audio.volume = 1
    audio.startTime = 0
    audio.onEnded(() => setPlayingTtsId((cur) => (cur === id ? null : cur)))
    audio.onStop(() => setPlayingTtsId((cur) => (cur === id ? null : cur)))
    audio.onError((e) => {
      console.warn('[tts] audio play failed', e)
      setPlayingTtsId((cur) => (cur === id ? null : cur))
      Taro.showToast({ title: '语音播放失败，请稍后再试', icon: 'none' })
    })
    setPlayingTtsId(id)
    audio.play()
  }
  const toggleTts = async ({ id, lineId, text, kana, audioText, forceSlow }) => {
    if (ttsLoadingId || !id) return
    if (playingTtsId === id) {
      stopTts()
      return
    }
    // Determine audioText: use explicit audioText (for particles), then kana, then text
    const ttsText = normalizeTtsText(audioText || text)
    if (!ttsText) return
    if (ttsText.length > 120) {
      Taro.showToast({ title: '这句歌词太长了，暂不支持朗读', icon: 'none' })
      return
    }
    stopTts()

    // Determine source type
    const isDemo = activeSong && activeSong.demo
    const srcType = isDemo ? 'whitelist_song' : (activeSongId ? 'user_uploaded_song' : 'platform_card')
    const isSlow = forceSlow != null ? forceSlow : ttsSlow
    const speedScale = isSlow ? 0.65 : 0.9

    const request = {
      audioText: ttsText,
      text: normalizeTtsText(text),
      voice: ttsVoice,
      speedScale,
    }
    const localCacheKey = buildTtsLocalCacheKey(request)
    const localSrc = getCachedTtsAudioSrc(localCacheKey)
    if (localSrc) {
      playTtsSrc(id, localSrc)
      return
    }
    setTtsLoadingId(id)
    try {
      const r = await ensureTtsAsset({
        source: srcType,
        songId: activeSongId || '',
        lineId: lineId || '',
        assetType: isSlow ? 'sentence_slow' : 'sentence_normal',
        audioText: ttsText,
        text: normalizeTtsText(text),
        voice: ttsVoice,
        speedScale,
      })
      const src = await resolveTtsAudioSrc(r, localCacheKey)
      if (!src) throw new Error('missing audio url')
      playTtsSrc(id, src)
    } catch (e) {
      ttsToast(e)
    } finally {
      setTtsLoadingId((cur) => (cur === id ? null : cur))
    }
  }
  const toggleLineTts = () => toggleTts({
    id: currentTtsBaseId() + (ttsSlow ? ':slow' : ''),
    lineId: currentLineId(),
    text: current && current.original,
    kana: current && current.furigana,
    forceSlow: ttsSlow,
  })
  const toggleLineTtsSlow = () => toggleTts({
    id: currentTtsBaseId() + ':slow',
    lineId: currentLineId(),
    text: current && current.original,
    kana: current && current.furigana,
    forceSlow: true,
  })
  const playWordTts = () => {
    const detail = modalDetail || (current && current.detail) || {}
    const word = detail.word || ''
    return toggleTts({
      id: currentTtsBaseId() + ':word:' + word,
      lineId: currentLineId() + '-word',
      text: word,
      kana: detail.kana || '',
    })
  }
  // Cumulative-tap easter egg①: every TAP_EGG_THRESHOLD-th tap on the example
  // 🔊 flashes one gentle line, then stays quiet for a cooldown. No time window
  // — taps just accumulate, so pace doesn't matter (a plain counter, not a combo).
  const bumpExampleTap = () => {
    const now = Date.now()
    const s = eggTapRef.current
    if (now < s.coolUntil) return
    s.count += 1
    if (s.count >= TAP_EGG_THRESHOLD) {
      s.count = 0
      s.coolUntil = now + TAP_EGG_COOLDOWN_MS
      setEggFlash(TAP_EGG_MESSAGE)
      if (eggFlashTimerRef.current) clearTimeout(eggFlashTimerRef.current)
      eggFlashTimerRef.current = setTimeout(() => setEggFlash(''), 4000)
    }
  }
  const toggleEgg = () => setEggOpen((o) => !o)
  const playExampleTts = () => {
    bumpExampleTap()
    const detail = modalDetail || (current && current.detail) || {}
    const jp = detail.example && detail.example.jp
    return toggleTts({
      id: currentTtsBaseId() + ':example',
      lineId: currentLineId() + '-example',
      text: jp || '',
      kana: '',
    })
  }
  const playTokenTts = (tok, index) => {
    const tokens = (current && current.tokens) || []
    const displayText = tok && tok.text ? String(tok.text).trim() : ''
    // For particles, play the preceding word + particle
    const audioText = resolveTokenAudioText(tok, index, tokens)
    return toggleTts({
      id: currentTtsBaseId() + ':token:' + index + ':' + displayText,
      lineId: currentLineId() + '-token-' + index,
      text: displayText,
      audioText: audioText || displayText,
      kana: tok && tok.reading ? tok.reading : '',
    })
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
    // Hard limits mirrored from the parse cloud function — reject locally so
    // an invalid submit never spends a cloud call (or a daily-quota slot).
    if (!lyricsText.trim()) {
      setParseNotice(''); setParseError('没有可解析的歌词，请先粘贴或输入日文歌词。')
      return
    }
    if (lyricsText.length > MAX_LYRICS_CHARS) {
      setParseNotice(''); setParseError('歌词最多支持 5000 字，请删减后再试。')
      return
    }
    if (!looksJapanese(lyricsText)) {
      setParseNotice(''); setParseError('这段内容看起来不是日语歌词，UtaNote 目前只支持日语歌曲，请确认后再试。')
      return
    }
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
      const { song, songs: next } = addSong({ lyrics: lyricsText, sentences: r.sentences, title: songTitle.trim() || r.title || undefined })
      setSongs(next); setActiveSongId(song.id); setCardIndex(0)
      setActiveTab('study'); setStudyPhase('tasks')
      setSongTitle('')
      setStreakDays(recordStudy())
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

  const currentLine = currentTtsBaseId()
  const slowLineId = currentLine + ':slow'
  const isTtsLoading = !!ttsLoadingId && (ttsLoadingId === currentLine || ttsLoadingId === slowLineId)
  const isLinePlaying = !!playingTtsId && (playingTtsId === currentLine || playingTtsId === slowLineId)
  const isTtsLoadingSlow = !!ttsLoadingId && ttsLoadingId === slowLineId
  const isLinePlayingSlow = !!playingTtsId && playingTtsId === slowLineId
  const playGlyph = isTtsLoading ? '…' : isLinePlaying ? '❚❚' : '▶'
  const playIconColor = isTtsLoading || isLinePlaying ? 'var(--accent-light)' : 'var(--ink-5)'
  const playLabel = isTtsLoading ? '生成中' : isLinePlaying ? '播放中' : '朗读'
  const slowLabel = isTtsLoadingSlow ? '生成中' : isLinePlayingSlow ? '慢速中' : '慢速'
  const slowColor = isTtsLoadingSlow || isLinePlayingSlow ? 'var(--accent-light)' : 'var(--ink-5)'
  const ttsColorFor = (id) => (ttsLoadingId === id || playingTtsId === id ? 'var(--accent-light)' : 'var(--ink-5)')

  const tabs = [
    { key: 'home', label: '首页', icon: '⌂' },
    { key: 'study', label: '学习', icon: '♪' },
    { key: 'library', label: '词库', icon: '▤' },
    { key: 'me', label: '我的', icon: '◯' },
  ].map((t) => {
    const active = activeTab === t.key && !aboutOpen
    return {
      ...t,
      active,
      color: active ? 'var(--accent-light)' : 'var(--ink-4)',
      onClick: () => { setAboutOpen(false); setTab(t.key) },
    }
  })

  const taskRows = sentences.map((row, i) => ({
    key: row.label + '-' + i,
    label: row.label,
    text: row.original,
    status: row.status,
    badgeBg: row.status === '新学' ? 'rgba(165,168,236,0.15)' : 'var(--ink-06)',
    badgeColor: row.status === '新学' ? 'var(--accent-light)' : 'var(--ink-4)',
    borderColor: i === 0 ? 'rgba(165,168,236,0.45)' : 'var(--ink-06)',
    onClick: () => openCard(i),
  }))

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
      bg: active ? 'rgba(165,168,236,0.18)' : 'var(--ink-04)',
      color: active ? 'var(--accent-light)' : 'var(--ink-5)',
      border: active ? '1px solid rgba(165,168,236,0.4)' : '1px solid var(--ink-07)',
      onClick: () => setLibraryFilter(f.key),
    }
  })
  const libraryStats = {
    total: vocabAll.length,
    mastered: vocabAll.filter((v) => v.mastery === 'mastered').length,
    learning: vocabAll.filter((v) => v.mastery === 'learning').length,
  }

  // ── SUMMARY (current song) — real data only. The app has no time-series
  // source (mastery is untimestamped; streak stores only last-day + count),
  // so there are no "this week" deltas, study-minutes, or 7-day check-ins.
  const masteredSentences = libraryStats.mastered
  const studiedSentences = vocabAll.filter((v) => v.mastery !== 'new').length
  const masteryProgressPct = total ? Math.round((masteredSentences / total) * 100) : 0
  const summaryStats = [
    { value: String(studiedSentences), label: '已学句子' },
    { value: String(masteredSentences), label: '已掌握' },
    { value: streakDays > 0 ? String(streakDays) : '—', label: '连续天数' },
  ]
  const shareTitle = activeSong && studiedSentences > 0
    ? `我在 UtaNote 学会了《${activeSong.title}》的 ${studiedSentences} 句日语歌词！`
    : '用日语歌学日语 · UtaNote'

  const detail = modalDetail || (current && current.detail) || {}
  const exampleEgg = findEasterEgg(activeSongId, detail.word)
  const isFav = !!favorites[detail.word]
  const wordTtsId = currentTtsBaseId() + ':word:' + (detail.word || '')
  const exampleTtsId = currentTtsBaseId() + ':example'
  // The word-detail 🔊 buttons are emoji — CSS `color` can't tint them, so the
  // existing loading→color-change trick is invisible there. Surface loading
  // as its own flag instead, and swap in a real spinner (see index.jsx).
  const isWordTtsLoading = ttsLoadingId === wordTtsId
  const isExampleTtsLoading = ttsLoadingId === exampleTtsId

  const tokenViews = ((current && current.tokens) || []).map((tok, i) => {
    const id = currentTtsBaseId() + ':token:' + i + ':' + (tok.text || '')
    const active = ttsLoadingId === id || playingTtsId === id
    return {
      key: i,
      text: tok.text,
      reading: tok.reading,
      role: tok.role,
      bg: active ? 'rgba(165,168,236,0.14)' : tok.type === 'particle' ? 'transparent' : 'var(--ink-05)',
      border: active ? '1px solid rgba(165,168,236,0.52)' : tok.type === 'particle' ? '1px dashed var(--ink-18)' : '1px solid var(--ink-08)',
      color: active ? 'var(--accent-light)' : tok.type === 'particle' ? 'var(--ink-55)' : 'var(--text-body)',
      weight: active || tok.type !== 'particle' ? 600 : 400,
      onClick: () => playTokenTts(tok, i),
    }
  })

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
  const ttsVoiceLabel = (TTS_VOICE_OPTIONS.find((o) => o.key === ttsVoice) || TTS_VOICE_OPTIONS[0]).label
  const setTtsVoice = (voice) => {
    if (!TTS_VOICE_OPTIONS.some((o) => o.key === voice)) return
    saveTtsVoice(voice)
    setTtsVoiceState(voice)
  }

  const streakLabel = streakDays > 0 ? `连续学习 ${streakDays} 天 🔥` : '今天开始学习吧 ✨'

  return {
    isHome, isTasks, isCard, isSummary, isLibrary, isMe, isAbout, showTabBar, showModal, modalClosing,
    themeClass: themeMode === 'light' ? 'theme-light' : '',
    streakDays, streakLabel,
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
    cardAnimClass: navDir === 'prev' ? 'card-in-prev' : 'card-in-next',
    romajiOpen,
    romajiToggleLabel: romajiOpen ? '收起假名/罗马音' : '显示假名/罗马音',
    // Base 45deg makes a border-right+border-bottom box read as a down chevron;
    // +180deg flips it to point up when the panel is open.
    romajiArrowRotate: romajiOpen ? 'rotate(225deg)' : 'rotate(45deg)',
    toggleRomaji, openWordModal, backToTasks, prevCard, nextCard,
    prevOpacity: safeIndex === 0 ? 0.4 : 1,
    nextLabel: safeIndex >= total - 1 ? '完成' : '下一句',
    togglePlay: toggleLineTts, toggleSlow: toggleLineTtsSlow, playGlyph, playIconColor, playLabel, isTtsLoading, isLinePlaying,
    slowLabel, slowColor, ttsSlow, setTtsSlow, playWordTts, playExampleTts,
    wordPlayIconColor: ttsColorFor(wordTtsId),
    examplePlayIconColor: ttsColorFor(exampleTtsId),
    isWordTtsLoading, isExampleTtsLoading,
    exampleEgg, eggOpen, toggleEgg, eggFlash,
    summaryStats, summaryStudied: studiedSentences, summaryTotal: total, summaryMastered: masteredSentences, masteryProgressPct, shareTitle, goHome,
    librarySearch, setSearch, libraryFilterChips, libraryStats, filteredVocab,
    mySongs, importedCount: songs.filter((s) => !s.demo).length,
    currentDetail: detail,
    favoriteGlyph: isFav ? '★' : '☆',
    favoriteColor: isFav ? 'var(--warning)' : 'var(--ink-4)',
    toggleFavorite, closeWordModal,
    currentMastery,
    currentMasteryLabel: MASTERY_LABEL[currentMastery],
    currentMasteryColor: MASTERY_COLOR[currentMastery],
    currentMasteryBorder: MASTERY_BORDER[currentMastery],
    markAsMastered: () => markAsMastered(safeIndex),
    fontScale, fontScaleLabel, fontScaleOptions: FONT_SCALE_OPTIONS, setFontScaleAction,
    ttsVoice, ttsVoiceLabel, ttsVoiceOptions: TTS_VOICE_OPTIONS, setTtsVoice,
    openAbout, closeAbout,
    navBarPaddingTop: navMetrics.navBarPaddingTop,
    navBarHeight: navMetrics.navBarHeight,
    navBarRightReserve: navMetrics.navBarRightReserve,
    // CARD screen reserves the full fixed nav-bar band above its content;
    // every other screen has no header row there, so it only needs to clear
    // the capsule itself — a much shorter gap.
    contentTopCard: navMetrics.navBarPaddingTop + navMetrics.navBarHeight + 8,
    contentTopDefault: navMetrics.capsuleBottom + 6,
    // Home's title sits left of the capsule (no horizontal overlap), so it
    // can ride a bit higher than other screens for a bolder opening feel.
    contentTopHome: navMetrics.capsuleBottom - 6,
  }
}
