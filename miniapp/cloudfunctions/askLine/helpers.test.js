const assert = require('assert')
const {
  PROMPT_VERSION,
  MAX_TEXT_CHARS,
  normalizeText,
  normalizeQuestionType,
  normalizeLine,
  buildCacheKey,
  buildSingingMessages,
  extractJSON,
  normalizeAnswer,
  answerToSafetyText,
  splitContentForSafety,
  contentSafetyDecision,
} = require('./helpers')

// ── normalizeQuestionType: only known enum values pass ───────────
assert.strictEqual(normalizeQuestionType('singing'), 'singing')
assert.strictEqual(normalizeQuestionType(' singing '), 'singing')
assert.strictEqual(normalizeQuestionType('usage'), '')
assert.strictEqual(normalizeQuestionType('给我讲个笑话'), '') // free text never becomes a question
assert.strictEqual(normalizeQuestionType(''), '')
assert.strictEqual(normalizeQuestionType(null), '')

// ── normalizeText: trim, collapse, orthography guard ─────────────
assert.strictEqual(normalizeText('  夜風が  静かに '), '夜風が 静かに')
assert.strictEqual(normalizeText('夜风が'), '夜風が') // simplified 风 → 風
assert.strictEqual(normalizeText(null), '')

// ── normalizeLine: required text, limits, kana collapsing ────────
assert.strictEqual(normalizeLine(null).ok, false)
assert.strictEqual(normalizeLine({ text: '' }).code, 'TEXT_EMPTY')
assert.strictEqual(normalizeLine({ text: '   ' }).code, 'TEXT_EMPTY')
assert.strictEqual(normalizeLine({ text: 'あ'.repeat(MAX_TEXT_CHARS + 1) }).code, 'TEXT_TOO_LONG')
{
  const r = normalizeLine({ text: ' 夜風が静かに 窓をたたく ', kana: 'よかぜ が しずかに まど を たたく' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.line.text, '夜風が静かに 窓をたたく')
  assert.strictEqual(r.line.kana, 'よかぜがしずかにまどをたたく') // furigana spaces collapsed
}
{
  const r = normalizeLine({ text: '窓' }) // kana optional
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.line.kana, '')
}

// ── buildCacheKey: stable, and sensitive to every answer-shaping input ──
const base = { questionType: 'singing', text: '夜風が静かに', kana: 'よかぜがしずかに', model: 'deepseek-chat' }
assert.strictEqual(buildCacheKey(base), buildCacheKey({ ...base }))
// whitespace/orthography variants land on the same entry
assert.strictEqual(buildCacheKey(base), buildCacheKey({ ...base, text: ' 夜风が静かに ' }))
assert.strictEqual(buildCacheKey(base), buildCacheKey({ ...base, kana: 'よかぜ が しずかに' }))
// anything that changes the answer changes the key
assert.notStrictEqual(buildCacheKey(base), buildCacheKey({ ...base, text: '窓をたたく' }))
assert.notStrictEqual(buildCacheKey(base), buildCacheKey({ ...base, kana: 'ちがうよみ' }))
assert.notStrictEqual(buildCacheKey(base), buildCacheKey({ ...base, model: 'deepseek-reasoner' }))
assert.notStrictEqual(buildCacheKey(base), buildCacheKey({ ...base, questionType: 'other' }))
assert.strictEqual(buildCacheKey(base).length, 32)

// ── buildSingingMessages: line lands in the user prompt, melody ban in system ──
{
  const messages = buildSingingMessages({ text: '夜風が静かに', kana: 'よかぜがしずかに' })
  assert.strictEqual(messages.length, 2)
  assert.strictEqual(messages[0].role, 'system')
  assert.ok(messages[0].content.includes('严禁编造'))
  assert.ok(messages[0].content.includes('kanaBeats'))
  assert.ok(messages[1].content.includes('夜風が静かに'))
  assert.ok(messages[1].content.includes('よかぜがしずかに'))
  // without kana the prompt says so instead of interpolating an empty「」
  const noKana = buildSingingMessages({ text: '窓', kana: '' })
  assert.ok(noKana[1].content.includes('未提供'))
}

// ── extractJSON: fenced, bare, prose-padded, empty ───────────────
assert.deepStrictEqual(extractJSON('{"tips":[]}'), { tips: [] })
assert.deepStrictEqual(extractJSON('```json\n{"a":1}\n```'), { a: 1 })
assert.deepStrictEqual(extractJSON('好的：{"a":3} 完毕'), { a: 3 })
assert.throws(() => extractJSON(''), /模型返回为空/)

// ── normalizeAnswer: valid shape passes, junk throws, excess clamps ──
{
  const a = normalizeAnswer({
    kanaBeats: 'よ・か・ぜ',
    tips: [{ title: '「を」唱 o', detail: '助词を唱作 o。' }],
    watchOut: '别把长音唱短。',
  })
  assert.deepStrictEqual(a, {
    kanaBeats: 'よ・か・ぜ',
    tips: [{ title: '「を」唱 o', detail: '助词を唱作 o。' }],
    watchOut: '别把长音唱短。',
  })
}
// tips beyond 4 are dropped; entries missing title or detail are dropped
{
  const tips = Array.from({ length: 6 }, (_, i) => ({ title: `要点${i}`, detail: `说明${i}` }))
  tips.push({ title: '没有说明' })
  const a = normalizeAnswer({ kanaBeats: 'よ', tips, watchOut: '' })
  assert.strictEqual(a.tips.length, 4)
}
// long fields are clamped, not rejected
{
  const a = normalizeAnswer({ kanaBeats: 'よ'.repeat(500), tips: [{ title: 'あ'.repeat(50), detail: 'い'.repeat(500) }], watchOut: 'う'.repeat(500) })
  assert.strictEqual(a.kanaBeats.length, 200)
  assert.strictEqual(a.tips[0].title.length, 20)
  assert.strictEqual(a.tips[0].detail.length, 120)
  assert.strictEqual(a.watchOut.length, 120)
}
// an answer with neither kanaBeats nor tips is useless → throw (caller retries)
assert.throws(() => normalizeAnswer({ kanaBeats: '', tips: [], watchOut: '一句话' }))
assert.throws(() => normalizeAnswer(null))
assert.throws(() => normalizeAnswer('not an object'))
// kanaBeats alone (tips empty) still passes — degraded but renderable
assert.strictEqual(normalizeAnswer({ kanaBeats: 'よ・る', tips: [] }).kanaBeats, 'よ・る')

// ── answerToSafetyText: every visible field is covered ───────────
{
  const s = answerToSafetyText({ kanaBeats: 'よ・る', tips: [{ title: 'T', detail: 'D' }], watchOut: 'W' })
  for (const part of ['よ・る', 'T', 'D', 'W']) assert.ok(s.includes(part))
  assert.strictEqual(answerToSafetyText({ kanaBeats: '', tips: [], watchOut: '' }), '')
}

// ── content safety helpers ───────────────────────────────────────
assert.deepStrictEqual(splitContentForSafety('  あいう  ', 2), ['あい', 'う'])
assert.deepStrictEqual(splitContentForSafety('', 2), [])
assert.deepStrictEqual(contentSafetyDecision({ errCode: 0, result: { suggest: 'pass' } }), { ok: true })
assert.deepStrictEqual(contentSafetyDecision({ errCode: 87014 }), { ok: false, code: 'CONTENT_RISK' })
assert.deepStrictEqual(contentSafetyDecision({ errCode: 0, result: { suggest: 'risky' } }), { ok: false, code: 'CONTENT_RISK' })
assert.deepStrictEqual(contentSafetyDecision({ errCode: -1 }), { ok: false, code: 'CONTENT_SAFETY_UNAVAILABLE' })

// PROMPT_VERSION participates in the cache key via buildCacheKey's join —
// changing it must invalidate every cached answer. Guard the constant so a
// prompt edit without a version bump at least trips a conscious test update.
assert.strictEqual(PROMPT_VERSION, 'singing-v1')

console.log('askLine helpers: all tests passed')
