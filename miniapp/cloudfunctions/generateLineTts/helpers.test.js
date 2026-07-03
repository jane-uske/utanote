const assert = require('assert')
const {
  validateText,
  normalizeSpeedScale,
  voiceToSpeaker,
  buildCacheKey,
  cloudPathSegment,
} = require('./helpers')

assert.strictEqual(validateText('  春 の 風  ').text, '春 の 風')
assert.strictEqual(validateText('夜风が静かに').text, '夜風が静かに')
assert.strictEqual(validateText('').code, 'EMPTY_TEXT')
assert.strictEqual(validateText('あ'.repeat(121)).code, 'TEXT_TOO_LONG')
assert.strictEqual(normalizeSpeedScale(0.75), 0.75)
assert.strictEqual(normalizeSpeedScale(9), 1.5)
assert.strictEqual(normalizeSpeedScale('bad'), 0.9)
assert.strictEqual(voiceToSpeaker('voicevox_metan_normal'), 2)
assert.strictEqual(voiceToSpeaker('voicevox_zundamon_normal'), 3)
assert.strictEqual(voiceToSpeaker('voicevox_sora_normal'), 16)
assert.strictEqual(voiceToSpeaker('voicevox_default_female'), 2)
assert.strictEqual(voiceToSpeaker('unknown'), 16)

const keyA = buildCacheKey({ songId: 's1', lineId: 'l1', text: '君がいた', voice: 'voicevox_default_female', speedScale: 0.9 })
const keyB = buildCacheKey({ songId: 's1', lineId: 'l1', text: '君がいた', voice: 'voicevox_default_female', speedScale: 1.15 })
const keyC = buildCacheKey({ songId: 's1', lineId: 'l1', text: '君がいた', voice: 'voicevox_zundamon_normal', speedScale: 0.9 })
assert.match(keyA, /^[a-f0-9]{32}$/)
assert.notStrictEqual(keyA, keyB)
assert.notStrictEqual(keyA, keyC)
assert.strictEqual(cloudPathSegment('song/../x', 'fallback'), 'song_.._x')

console.log('generateLineTts helpers ok')
