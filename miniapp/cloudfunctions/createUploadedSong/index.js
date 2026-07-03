// WeChat Cloud Function: createUploadedSong
// User uploads lyrics → creates a learning asset package (song_tts_assets).
// Does NOT batch-generate TTS — audio is generated lazily on first play.

const cloud = require('wx-server-sdk')

// ── Configuration (mirrors ensureTtsAsset/helpers.js) ─────────────
const MAX_LINES_PER_USER_SONG = Number(process.env.MAX_LINES_PER_USER_SONG || 60)
const MAX_TEXT_CHARS = Number(process.env.TEXT_MAX_LENGTH || 120)
const DAILY_UPLOAD_SONG_LIMIT = Number(process.env.DAILY_UPLOAD_SONG_LIMIT || 1)

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function makeLineId(index) {
  return `L${String(index + 1).padStart(3, '0')}`
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', error: '无法识别用户，请稍后再试。' }
  }

  // ── 1. Validate input ───────────────────────────────────────────
  const lyricsText = String(event.lyricsText || '').trim()
  if (!lyricsText) {
    return { ok: false, code: 'LYRICS_EMPTY', error: '歌词不能为空。' }
  }

  // ── 2. Split & clean lines ──────────────────────────────────────
  const rawLines = lyricsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  if (rawLines.length === 0) {
    return { ok: false, code: 'LYRICS_EMPTY', error: '没有有效的歌词行。' }
  }

  if (rawLines.length > MAX_LINES_PER_USER_SONG) {
    return {
      ok: false,
      code: 'TOO_MANY_LINES',
      error: `歌词最多支持 ${MAX_LINES_PER_USER_SONG} 行，当前有 ${rawLines.length} 行。`,
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].length > MAX_TEXT_CHARS) {
      return {
        ok: false,
        code: 'LINE_TOO_LONG',
        error: `第 ${i + 1} 行太长，每行最多 ${MAX_TEXT_CHARS} 字。`,
      }
    }
  }

  // ── 3. Check daily upload limit ─────────────────────────────────
  const date = todayKey()
  try {
    const { data } = await db.collection('tts_usage_daily').where({ openid: OPENID, date }).limit(1).get()
    const existing = data && data[0]
    const uploadCount = existing ? Number(existing.uploadSongCount || 0) : 0
    if (uploadCount >= DAILY_UPLOAD_SONG_LIMIT) {
      return {
        ok: false,
        code: 'DAILY_UPLOAD_LIMIT_EXCEEDED',
        error: `每天最多上传 ${DAILY_UPLOAD_SONG_LIMIT} 首歌词，明天再来吧。`,
      }
    }
  } catch (e) {
    console.warn('upload limit check failed:', e && e.message)
    return { ok: false, code: 'RATE_LIMIT_FAILED', error: '限流检查失败，请稍后再试。' }
  }

  // ── 4. Create song ──────────────────────────────────────────────
  const songId = 'song-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)
  const title = String(event.title || '').trim() || rawLines[0].slice(0, 16)
  const artist = String(event.artist || '').trim() || ''

  // Build lines array for song_tts_assets
  const lines = rawLines.map((text, i) => ({
    lineId: makeLineId(i),
    text,
    normalizedText: text.replace(/\s+/g, ' '),
    sentenceNormal: {
      text,
      audioText: text,
      speedScale: 0.9,
      fileID: '',
      cacheKey: '',
      status: 'empty',
      updatedAt: null,
    },
    sentenceSlow: {
      text,
      audioText: text,
      speedScale: 0.65,
      fileID: '',
      cacheKey: '',
      status: 'empty',
      updatedAt: null,
    },
    chunks: [], // populated lazily when user views tokens
  }))

  // ── 5. Save song_tts_assets ─────────────────────────────────────
  try {
    await db.collection('song_tts_assets').add({
      data: {
        songId,
        cardId: '',
        ownerOpenid: OPENID,
        source: 'user_uploaded_song',
        title,
        artist,
        lines,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  } catch (e) {
    console.warn('create song failed:', e && e.message)
    return { ok: false, code: 'CREATE_SONG_FAILED', error: '创建歌曲失败，请稍后再试。' }
  }

  // ── 6. Increment upload count ───────────────────────────────────
  try {
    const { data } = await db.collection('tts_usage_daily').where({ openid: OPENID, date }).limit(1).get()
    const existing = data && data[0]
    if (existing) {
      await db.collection('tts_usage_daily').doc(existing._id).update({
        data: { uploadSongCount: _.inc(1), updatedAt: db.serverDate() },
      })
    } else {
      await db.collection('tts_usage_daily').add({
        data: {
          openid: OPENID,
          date,
          uploadSongCount: 1,
          generatedAssetCount: 0,
          customTextGenerateCount: 0,
          updatedAt: db.serverDate(),
        },
      })
    }
  } catch (e) {
    console.warn('incr upload count failed:', e && e.message)
  }

  return {
    ok: true,
    songId,
    title,
    artist,
    lineCount: lines.length,
    lines: lines.map((l) => ({ lineId: l.lineId, text: l.text })),
  }
}
