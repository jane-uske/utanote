const assert = require('assert')
const {
  validateText,
  normalizeSource,
  normalizeAssetType,
  normalizeSpeedScale,
  normalizePitchScale,
  normalizeIntonationScale,
  voiceToSpeaker,
  buildCacheKey,
  buildAssetKey,
  cloudPathSegment,
  userCounterForSource,
} = require('./helpers')

assert.strictEqual(validateText('  春 の 風  ').text, '春 の 風')
assert.strictEqual(validateText('夜风が静かに').text, '夜風が静かに')
assert.strictEqual(validateText('').code, 'TEXT_EMPTY')
assert.strictEqual(validateText('あ'.repeat(121)).code, 'TEXT_TOO_LONG')

assert.strictEqual(normalizeSource('', 'demo'), 'platform_card')
assert.strictEqual(normalizeSource('', 'song-1'), 'user_uploaded_song')
assert.strictEqual(normalizeSource('whitelist_song'), 'whitelist_song')
assert.strictEqual(normalizeSource('bad'), '')
assert.strictEqual(normalizeAssetType('sentence_slow'), 'sentence_slow')
assert.strictEqual(normalizeAssetType('bad'), '')

assert.strictEqual(normalizeSpeedScale(0.75), 0.75)
assert.strictEqual(normalizeSpeedScale(9), 1.5)
assert.strictEqual(normalizeSpeedScale('bad'), 0.9)
assert.strictEqual(normalizePitchScale(9), 0.15)
assert.strictEqual(normalizeIntonationScale(-1), 0)
assert.strictEqual(voiceToSpeaker('voicevox_metan_normal'), 2)
assert.strictEqual(voiceToSpeaker('voicevox_zundamon_normal'), 3)
assert.strictEqual(voiceToSpeaker('voicevox_sora_normal'), 16)
assert.strictEqual(voiceToSpeaker('voicevox_default_female'), 2)
assert.strictEqual(voiceToSpeaker('unknown'), 16)
assert.strictEqual(voiceToSpeaker('unknown', 31), 31)

const keyA = buildCacheKey({ songId: 's1', lineId: 'l1', text: '君がいた', voice: 'voicevox_default_female', speedScale: 0.9 })
const keyB = buildCacheKey({ songId: 's2', lineId: 'l9', text: '君がいた', voice: 'voicevox_default_female', speedScale: 0.9 })
const keyC = buildCacheKey({ songId: 's1', lineId: 'l1', text: '君がいた', voice: 'voicevox_default_female', speedScale: 1.15 })
assert.match(keyA, /^[a-f0-9]{32}$/)
assert.strictEqual(keyA, keyB, 'global cache must not include songId/lineId')
assert.notStrictEqual(keyA, keyC)

const assetA = buildAssetKey({ source: 'user_uploaded_song', songId: 's1', lineId: 'l1', assetType: 'chunk', chunkKey: 'ga', audioText: '夜風が', speedScale: 0.9 })
const assetB = buildAssetKey({ source: 'user_uploaded_song', songId: 's1', lineId: 'l2', assetType: 'chunk', chunkKey: 'ga', audioText: '夜風が', speedScale: 0.9 })
assert.notStrictEqual(assetA, assetB, 'asset binding is per song/line even when audio cache is global')
assert.strictEqual(userCounterForSource('user_uploaded_song'), 'generatedAssetCount')
assert.strictEqual(userCounterForSource('user_custom_text'), 'customTextGenerateCount')
assert.strictEqual(userCounterForSource('platform_card'), null)
assert.strictEqual(cloudPathSegment('song/../x', 'fallback'), 'song_.._x')

console.log('generateLineTts helpers ok')
