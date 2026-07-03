// WeChat Cloud Function: ensureTtsAsset
// Ensures a TTS audio asset exists. Checks song_tts_assets first, then global
// tts_cache, then generates via local VOICEVOX service if needed.
//
// Cache key does NOT contain openid — the whole platform shares cached audio.

const cloud = require('wx-server-sdk')
const {
  VALID_SOURCES,
  VALID_ASSET_TYPES,
  todayKey,
  normalizeText,
  validateText,
  normalizeSpeedScale,
  voiceToSpeaker,
  buildCacheKey,
  buildCloudPath,
  httpRequestJSON,
  getTempURL,
  findAssetInDoc,
  DEFAULT_VOICE,
  DEFAULT_SPEAKER,
  DEFAULT_SPEED_SCALE,
  DEFAULT_SLOW_SPEED_SCALE,
  MAX_TEXT_CHARS,
  DAILY_USER_ASSET_GENERATE_LIMIT,
  DAILY_CUSTOM_TEXT_GENERATE_LIMIT,
  GLOBAL_DAILY_TTS_GENERATE_LIMIT,
  TTS_REQUEST_TIMEOUT_MS,
  ENGINE,
  ENGINE_VERSION,
} = require('./helpers')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ── Usage tracking ────────────────────────────────────────────────

async function checkGlobalDailyLimit() {
  const date = todayKey()
  const { data } = await db.collection('tts_usage_global_daily').where({ date }).limit(1).get()
  const existing = data && data[0]
  const count = existing ? Number(existing.generateCount || 0) : 0
  if (count >= GLOBAL_DAILY_TTS_GENERATE_LIMIT) {
    return { ok: false, code: 'GLOBAL_TTS_LIMIT_EXCEEDED' }
  }
  return { ok: true, count }
}

async function incrGlobalDailyCount(count) {
  const date = todayKey()
  try {
    const { data } = await db.collection('tts_usage_global_daily').where({ date }).limit(1).get()
    const existing = data && data[0]
    if (existing) {
      await db.collection('tts_usage_global_daily').doc(existing._id).update({
        data: { generateCount: _.inc(1), updatedAt: db.serverDate() },
      })
    } else {
      await db.collection('tts_usage_global_daily').add({
        data: { date, generateCount: 1, updatedAt: db.serverDate() },
      })
    }
  } catch (e) {
    console.warn('incr global daily failed:', e && e.message)
  }
}

async function checkUserDailyLimit(openid, source) {
  const date = todayKey()
  const { data } = await db.collection('tts_usage_daily').where({ openid, date }).limit(1).get()
  const existing = data && data[0]

  if (source === 'user_uploaded_song') {
    const count = existing ? Number(existing.generatedAssetCount || 0) : 0
    if (count >= DAILY_USER_ASSET_GENERATE_LIMIT) {
      return { ok: false, code: 'DAILY_USER_ASSET_LIMIT_EXCEEDED', count, limit: DAILY_USER_ASSET_GENERATE_LIMIT }
    }
    return { ok: true, count, limit: DAILY_USER_ASSET_GENERATE_LIMIT, field: 'generatedAssetCount' }
  }

  if (source === 'user_custom_text') {
    const count = existing ? Number(existing.customTextGenerateCount || 0) : 0
    if (count >= DAILY_CUSTOM_TEXT_GENERATE_LIMIT) {
      return { ok: false, code: 'DAILY_CUSTOM_TEXT_LIMIT_EXCEEDED', count, limit: DAILY_CUSTOM_TEXT_GENERATE_LIMIT }
    }
    return { ok: true, count, limit: DAILY_CUSTOM_TEXT_GENERATE_LIMIT, field: 'customTextGenerateCount' }
  }

  // platform_card / whitelist_song: no user quota, but still subject to global limit
  return { ok: true, free: true }
}

async function incrUserDailyCount(openid, field) {
  const date = todayKey()
  try {
    const { data } = await db.collection('tts_usage_daily').where({ openid, date }).limit(1).get()
    const existing = data && data[0]
    if (existing) {
      await db.collection('tts_usage_daily').doc(existing._id).update({
        data: { [field]: _.inc(1), updatedAt: db.serverDate() },
      })
    } else {
      const doc = { openid, date, uploadSongCount: 0, generatedAssetCount: 0, customTextGenerateCount: 0, updatedAt: db.serverDate() }
      doc[field] = 1
      await db.collection('tts_usage_daily').add({ data: doc })
    }
  } catch (e) {
    console.warn('incr user daily failed:', e && e.message)
  }
}

// ── Cache & asset lookups ─────────────────────────────────────────

async function findTtsCache(cacheKey) {
  const { data } = await db.collection('tts_cache').where({ cacheKey }).limit(1).get()
  return data && data[0]
}

async function findSongAsset(songId, lineId, assetType, chunkKey) {
  if (!songId || !lineId) return null
  try {
    const { data } = await db.collection('song_tts_assets').where({ songId }).limit(1).get()
    const doc = data && data[0]
    if (!doc) return null
    const found = findAssetInDoc(doc, lineId, assetType, chunkKey)
    return found ? { doc, ...found } : null
  } catch (e) {
    console.warn('find song asset failed:', e && e.message)
    return null
  }
}

async function updateSongAsset(songId, lineIndex, assetType, chunkIndex, update) {
  try {
    const path = assetType === 'sentence_normal'
      ? `lines.${lineIndex}.sentenceNormal`
      : assetType === 'sentence_slow'
        ? `lines.${lineIndex}.sentenceSlow`
        : `lines.${lineIndex}.chunks.${chunkIndex}`

    // Build update object with dot-notation keys
    const updateData = {}
    for (const [key, value] of Object.entries(update)) {
      updateData[`${path}.${key}`] = value
    }
    updateData[`${path}.updatedAt`] = db.serverDate()
    updateData.updatedAt = db.serverDate()

    await db.collection('song_tts_assets').where({ songId }).update({ data: updateData })
  } catch (e) {
    console.warn('update song asset failed:', e && e.message)
  }
}

// ── TTS generation ────────────────────────────────────────────────

async function callLocalTts(text, voice, speaker, speedScale) {
  const endpoint = String(process.env.UTANOTE_TTS_ENDPOINT || '').trim().replace(/\/+$/, '')
  const token = String(process.env.UTANOTE_TTS_TOKEN || '').trim()
  if (!endpoint || !token) {
    throw Object.assign(new Error('TTS 服务未配置。'), { code: 'TTS_NOT_CONFIGURED' })
  }

  const speakerId = speaker || voiceToSpeaker(voice) || DEFAULT_SPEAKER

  const res = await httpRequestJSON(endpoint + '/internal/jp-tts', {
    'X-UtaNote-Token': token,
  }, {
    text,
    speaker: speakerId,
    voice,
    speedScale: normalizeSpeedScale(speedScale, DEFAULT_SPEED_SCALE),
    pitchScale: 0,
    intonationScale: 1,
    volumeScale: 1,
  }, TTS_REQUEST_TIMEOUT_MS)

  if (res.statusCode === 429) {
    throw Object.assign(new Error('语音生成繁忙，请稍后再试'), { code: 'TTS_BUSY' })
  }
  if (res.statusCode === 401) {
    throw Object.assign(new Error('TTS 服务鉴权失败'), { code: 'TTS_AUTH_FAILED' })
  }
  if (res.statusCode < 200 || res.statusCode >= 300 || !res.json || !res.json.audioBase64) {
    const code = (res.json && res.json.error) || `TTS_HTTP_${res.statusCode}`
    throw Object.assign(new Error('语音生成失败'), { code })
  }

  const tts = res.json
  return {
    audioBase64: tts.audioBase64,
    contentType: tts.contentType || 'audio/mpeg',
    ext: tts.ext || 'mp3',
    durationMs: tts.durationMs || null,
    engine: tts.engine || ENGINE,
    speakerId,
  }
}

// ── Main handler ──────────────────────────────────────────────────

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()

  // ── 1. Validate inputs ──────────────────────────────────────────
  const source = String(event.source || '')
  if (!VALID_SOURCES.includes(source)) {
    return { ok: false, code: 'INVALID_SOURCE', error: `无效的 source: ${source}` }
  }

  const assetType = String(event.assetType || 'sentence_normal')
  if (!VALID_ASSET_TYPES.includes(assetType)) {
    return { ok: false, code: 'INVALID_ASSET_TYPE', error: `无效的 assetType: ${assetType}` }
  }

  // Determine the text to synthesize
  let audioText = String(event.audioText || event.text || '').trim()
  if (!audioText) {
    return { ok: false, code: 'TEXT_EMPTY', error: '朗读文本不能为空。' }
  }
  if (audioText.length > MAX_TEXT_CHARS) {
    return { ok: false, code: 'TEXT_TOO_LONG', error: `这句歌词太长了，最多支持 ${MAX_TEXT_CHARS} 字。` }
  }

  const normalizedText = normalizeText(audioText)
  const voice = String(event.voice || DEFAULT_VOICE)
  const speaker = Number(event.speaker || voiceToSpeaker(voice) || DEFAULT_SPEAKER)
  const speedScale = normalizeSpeedScale(event.speedScale,
    assetType === 'sentence_slow' ? DEFAULT_SLOW_SPEED_SCALE : DEFAULT_SPEED_SCALE)
  const pitchScale = 0
  const intonationScale = 1

  const songId = event.songId ? String(event.songId) : ''
  const cardId = event.cardId ? String(event.cardId) : ''
  const lineId = event.lineId ? String(event.lineId) : ''
  const chunkKey = event.chunkKey ? String(event.chunkKey) : ''

  const cacheKey = buildCacheKey({ normalizedText, voice, speaker, speedScale, pitchScale, intonationScale })

  // ── 2. Check song_tts_assets (if songId provided) ───────────────
  if (songId && lineId) {
    const songAsset = await findSongAsset(songId, lineId, assetType, chunkKey)
    if (songAsset && songAsset.asset && songAsset.asset.fileID && songAsset.asset.status === 'ready') {
      // Already generated — return immediately
      const fileID = songAsset.asset.fileID
      return {
        ok: true,
        fileID,
        tempURL: await getTempURL(fileID, cloud),
        cacheKey: songAsset.asset.cacheKey || cacheKey,
        cacheHit: true,
        generated: false,
        quotaConsumed: false,
        freeAsset: source === 'platform_card' || source === 'whitelist_song',
        source,
        text: audioText,
        audioText,
        voice,
        speaker,
        speedScale,
      }
    }
  }

  // ── 3. Check global tts_cache ───────────────────────────────────
  try {
    const cached = await findTtsCache(cacheKey)
    if (cached && cached.fileID) {
      // Bind cache to song_tts_assets if we have song context
      if (songId && lineId) {
        const songAsset = await findSongAsset(songId, lineId, assetType, chunkKey)
        if (songAsset) {
          await updateSongAsset(songId, songAsset.lineIndex, assetType, songAsset.chunkIndex, {
            fileID: cached.fileID,
            cacheKey,
            status: 'ready',
          })
        }
      }

      return {
        ok: true,
        fileID: cached.fileID,
        tempURL: await getTempURL(cached.fileID, cloud),
        cacheKey,
        cacheHit: true,
        generated: false,
        quotaConsumed: false,
        freeAsset: source === 'platform_card' || source === 'whitelist_song',
        source,
        text: audioText,
        audioText,
        voice,
        speaker,
        speedScale,
      }
    }
  } catch (e) {
    console.warn('cache lookup failed:', e && e.message)
  }

  // ── 4. Need to generate — check quotas ──────────────────────────
  if (!OPENID) {
    return { ok: false, code: 'NO_OPENID', error: '无法识别用户，请稍后再试。' }
  }

  // 4a. Global daily limit (applies to all sources)
  const globalCheck = await checkGlobalDailyLimit()
  if (!globalCheck.ok) {
    return {
      ok: false,
      code: 'GLOBAL_TTS_LIMIT_EXCEEDED',
      error: '今日语音生成较多，请稍后再试，已生成的内容仍可继续播放。',
    }
  }

  // 4b. User daily limits (user_uploaded_song / user_custom_text only)
  let userQuota = null
  if (source === 'user_uploaded_song' || source === 'user_custom_text') {
    userQuota = await checkUserDailyLimit(OPENID, source)
    if (!userQuota.ok) {
      return {
        ok: false,
        code: userQuota.code,
        error: source === 'user_custom_text'
          ? '今日可生成的学习音频额度已用完，已生成的内容仍可继续播放。'
          : '今日可生成的学习音频额度已用完，已生成的内容仍可继续播放。',
        remainingGenerateCount: 0,
        dailyGenerateLimit: userQuota.limit,
      }
    }
  }

  // ── 5. Call local TTS service ───────────────────────────────────
  let tts
  try {
    tts = await callLocalTts(audioText, voice, speaker, speedScale)
  } catch (e) {
    console.warn('tts service failed:', e && (e.code || e.message))
    const code = e.code || 'TTS_ENGINE_FAILED'
    return {
      ok: false,
      code,
      error: code === 'TTS_BUSY'
        ? '语音生成繁忙，请稍后再试'
        : '语音生成失败，请稍后再试',
    }
  }

  // ── 6. Upload to cloud storage ──────────────────────────────────
  const audioBuffer = Buffer.from(String(tts.audioBase64 || ''), 'base64')
  if (!audioBuffer.length) {
    return { ok: false, code: 'EMPTY_AUDIO', error: '语音生成失败，请稍后再试。' }
  }

  const cloudPath = buildCloudPath({ source, songId, cardId, cacheKey })
  let fileID
  try {
    const uploaded = await cloud.uploadFile({ cloudPath, fileContent: audioBuffer })
    fileID = uploaded.fileID
  } catch (e) {
    console.warn('cloud upload failed:', e && e.message)
    return { ok: false, code: 'TTS_UPLOAD_FAILED', error: '语音保存失败，请稍后再试。' }
  }

  // ── 7. Write tts_cache (global) ─────────────────────────────────
  try {
    await db.collection('tts_cache').add({
      data: {
        cacheKey,
        normalizedText,
        originalText: audioText,
        voice,
        speaker: tts.speakerId,
        speedScale,
        pitchScale,
        intonationScale,
        engine: tts.engine || ENGINE,
        engineVersion: ENGINE_VERSION,
        fileID,
        cloudPath,
        contentType: tts.contentType,
        ext: tts.ext,
        durationMs: tts.durationMs,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  } catch (e) {
    console.warn('cache write failed:', e && e.message)
    // Non-fatal — the file is already uploaded
  }

  // ── 8. Update song_tts_assets (if song context) ─────────────────
  if (songId && lineId) {
    const songAsset = await findSongAsset(songId, lineId, assetType, chunkKey)
    if (songAsset) {
      await updateSongAsset(songId, songAsset.lineIndex, assetType, songAsset.chunkIndex, {
        fileID,
        cacheKey,
        status: 'ready',
      })
    }
  }

  // ── 9. Increment usage counters ─────────────────────────────────
  await incrGlobalDailyCount()

  if (userQuota && userQuota.field) {
    await incrUserDailyCount(OPENID, userQuota.field)
  }

  // For platform_card / whitelist_song: count as global only, no user quota deduction
  const quotaConsumed = source === 'user_uploaded_song' || source === 'user_custom_text'
  const freeAsset = source === 'platform_card' || source === 'whitelist_song'

  return {
    ok: true,
    fileID,
    tempURL: await getTempURL(fileID, cloud),
    cacheKey,
    cacheHit: false,
    generated: true,
    quotaConsumed,
    freeAsset,
    source,
    remainingGenerateCount: userQuota ? Math.max(0, userQuota.limit - userQuota.count - 1) : null,
    dailyGenerateLimit: userQuota ? userQuota.limit : null,
    text: audioText,
    audioText,
    voice,
    speaker,
    speedScale,
  }
}
