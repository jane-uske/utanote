const assert = require('assert')
const {
  extractJSON,
  chunk,
  runWithConcurrency,
  mergeChunkResults,
  buildTokenTrack,
  looksJapanese,
  splitContentForSafety,
  contentSafetyDecision,
} = require('./helpers')

// ── extractJSON: fenced, bare, prose-padded, empty ───────────────
assert.deepStrictEqual(extractJSON('{"sentences":[]}'), { sentences: [] })
assert.deepStrictEqual(extractJSON('```json\n{"a":1}\n```'), { a: 1 })
assert.deepStrictEqual(extractJSON('```\n{"a":2}\n```'), { a: 2 })
assert.deepStrictEqual(extractJSON('好的，结果如下：{"a":3} 完毕'), { a: 3 })
assert.throws(() => extractJSON(''), /模型返回为空/)

// ── chunk: empty, exact, remainder, oversize-size ────────────────
assert.deepStrictEqual(chunk([], 8), [])
assert.deepStrictEqual(chunk([1, 2, 3], 8), [[1, 2, 3]])
assert.deepStrictEqual(chunk([1, 2, 3, 4, 5, 6, 7, 8], 8), [[1, 2, 3, 4, 5, 6, 7, 8]])
assert.deepStrictEqual(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 8), [[1, 2, 3, 4, 5, 6, 7, 8], [9, 10]])
assert.strictEqual(chunk(Array.from({ length: 16 }, (_, i) => i), 8).length, 2)

// A worker that records the peak number of concurrently-running calls.
function makeTrackingWorker() {
  const state = { inFlight: 0, peak: 0 }
  const worker = async (item) => {
    state.inFlight++
    state.peak = Math.max(state.peak, state.inFlight)
    await new Promise((r) => setTimeout(r, 5))
    state.inFlight--
    return item * 2
  }
  return { state, worker }
}

// ── looksJapanese: kana-bearing text passes, kana-free text is rejected ──
assert.strictEqual(looksJapanese('夜風が静かに窓をたたく'), true)
assert.strictEqual(looksJapanese('こんにちは、世界'), true)
assert.strictEqual(looksJapanese('私は日本語を勉強しています'), true)
assert.strictEqual(looksJapanese('夜风轻轻地敲打着窗户'), false) // Chinese, no kana
assert.strictEqual(looksJapanese('Hello world, this is English lyrics'), false)
assert.strictEqual(looksJapanese(''), false)
assert.strictEqual(looksJapanese('   '), false)
assert.strictEqual(looksJapanese(null), false)

// ── content safety helpers: chunking and WeChat response decisions ──
assert.deepStrictEqual(splitContentForSafety('  あいう  ', 2), ['あい', 'う'])
assert.deepStrictEqual(splitContentForSafety('', 2), [])
assert.strictEqual(splitContentForSafety('あ'.repeat(4500)).length, 3)
assert.deepStrictEqual(contentSafetyDecision({ errCode: 0, result: { suggest: 'pass', label: 100 } }), { ok: true })
assert.strictEqual(contentSafetyDecision({ errCode: 0, result: { suggest: 'risky', label: 20001 } }).code, 'CONTENT_RISK')
assert.strictEqual(contentSafetyDecision({ errcode: 87014 }).code, 'CONTENT_RISK')
assert.strictEqual(contentSafetyDecision({ errCode: -1 }).code, 'CONTENT_SAFETY_UNAVAILABLE')

// ── buildTokenTrack: LLM boundaries win only when they reconstruct the line ──
const isParticle = (t) => new Set(['が', 'を', 'に', 'は', 'で', 'な', 'と']).has(t)

// REGRESSION（口触り事故）: 本地切 薄|く|透明|な|口触り|で，LLM 切 薄く|透明|な|口触り|で。
// 旧逻辑按下标贴数据 → く 拿到 とうめい、な 拿到 くちざわり，整句读音/角色左移一位。
// 新逻辑：LLM tokens 能拼回原句 → 直接采用 LLM 边界，读音落在正确的词上。
{
  const line = '薄く透明な口触りで'
  const localTokens = [
    { text: '薄', reading: '', type: 'content' },
    { text: 'く', reading: 'く', type: 'content' },
    { text: '透明', reading: '', type: 'content' },
    { text: 'な', reading: '', type: 'particle' },
    { text: '口触り', reading: '', type: 'content' },
    { text: 'で', reading: '', type: 'particle' },
  ]
  const enrichTokens = [
    { text: '薄く', reading: 'うすく', role: '状语：薄薄地' },
    { text: '透明', reading: 'とうめい', role: '形容动词词干' },
    { text: 'な', reading: '', role: '连体形词尾' },
    { text: '口触り', reading: 'くちざわり', role: '宾语：口感' },
    { text: 'で', reading: '', role: '助词' },
  ]
  const tokens = buildTokenTrack({ line, localTokens, enrichTokens, isParticle })
  assert.deepStrictEqual(tokens.map((t) => t.text), ['薄く', '透明', 'な', '口触り', 'で'])
  assert.strictEqual(tokens[0].reading, 'うすく')
  assert.strictEqual(tokens[1].reading, 'とうめい', '透明 的读音必须落在 透明 上，不能漂到 く')
  assert.strictEqual(tokens[3].reading, 'くちざわり', '口触り 的读音必须落在 口触り 上，不能漂到 な')
  assert.strictEqual(tokens[2].type, 'particle')
  assert.strictEqual(tokens[2].reading, '', '助词不带读音')
  assert.strictEqual(tokens[4].type, 'particle')

  // LLM tokens 拼不回原句（丢了 で）→ 整句退回本地切分，且不贴任何 LLM 数据
  const broken = enrichTokens.slice(0, 4)
  const fallback = buildTokenTrack({ line, localTokens, enrichTokens: broken, isParticle })
  assert.deepStrictEqual(fallback.map((t) => t.text), ['薄', 'く', '透明', 'な', '口触り', 'で'])
  assert.ok(fallback.every((t) => t.reading !== 'とうめい' && t.reading !== 'くちざわり'), '降级后不得残留任何 LLM 读音（宁缺勿错）')
  assert.strictEqual(fallback[3].role, '助词')
  assert.strictEqual(fallback[0].role, '', '降级后内容词不带 LLM 角色')
}

// 原句含空格、LLM 输出不含 → 忽略空白差异后仍算重建成功
{
  const line = '夜風が静かに 窓をたたく'
  const localTokens = [{ text: '夜風', reading: '', type: 'content' }]
  const enrichTokens = [
    { text: '夜風', reading: 'よかぜ', role: '主语' },
    { text: 'が', reading: '', role: '主格助词' },
    { text: '静かに', reading: 'しずかに', role: '状语' },
    { text: '窓', reading: 'まど', role: '宾语' },
    { text: 'を', reading: '', role: '宾格助词' },
    { text: 'たたく', reading: 'たたく', role: '谓语' },
  ]
  const tokens = buildTokenTrack({ line, localTokens, enrichTokens, isParticle })
  assert.strictEqual(tokens.length, 6)
  assert.strictEqual(tokens[0].reading, 'よかぜ')
}

// LLM tokens 为空/缺失/含空 text/多出内容 → 全部退回本地
{
  const line = 'ありがとう'
  const localTokens = [{ text: 'ありがとう', reading: 'ありがとう', type: 'content' }]
  for (const bad of [null, [], [{ text: '' }], [{ text: 'ありがとう' }, { text: '！' }], [{ reading: 'x' }]]) {
    const tokens = buildTokenTrack({ line, localTokens, enrichTokens: bad, isParticle })
    assert.deepStrictEqual(tokens.map((t) => t.text), ['ありがとう'], `enrichTokens=${JSON.stringify(bad)} 必须降级`)
  }
}

async function main() {
  // ── runWithConcurrency: order preserved, values correct ────────
  {
    const { worker } = makeTrackingWorker()
    const items = [1, 2, 3, 4, 5]
    const res = await runWithConcurrency(items, 2, worker)
    assert.strictEqual(res.length, 5)
    res.forEach((r, i) => {
      assert.strictEqual(r.status, 'fulfilled')
      assert.strictEqual(r.value, items[i] * 2)
    })
  }

  // ── runWithConcurrency: never exceeds the concurrency limit ────
  {
    const { state, worker } = makeTrackingWorker()
    await runWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, worker)
    assert.ok(state.peak <= 3, `peak ${state.peak} must be <= 3`)
    assert.strictEqual(state.peak, 3, '10 items / limit 3 should saturate the pool')
  }

  // ── runWithConcurrency: a throwing worker is isolated ──────────
  {
    const worker = async (item) => {
      if (item === 2) throw new Error('boom on 2')
      return item * 10
    }
    const res = await runWithConcurrency([1, 2, 3], 2, worker)
    assert.strictEqual(res[0].status, 'fulfilled')
    assert.strictEqual(res[0].value, 10)
    assert.strictEqual(res[1].status, 'rejected')
    assert.strictEqual(res[1].reason.message, 'boom on 2')
    assert.strictEqual(res[2].status, 'fulfilled')
    assert.strictEqual(res[2].value, 30)
  }

  // ── runWithConcurrency: limit > items, and empty input ─────────
  {
    const { worker } = makeTrackingWorker()
    const res = await runWithConcurrency([1, 2], 5, worker)
    assert.strictEqual(res.length, 2)
    assert.deepStrictEqual(await runWithConcurrency([], 4, worker), [])
  }

  const chunksAB = [['a', 'b', 'c'], ['d', 'e', 'f']] // two batches of 3 lines

  // ── mergeChunkResults: happy path, token usage summed ──────────
  {
    const results = [
      { status: 'fulfilled', value: { sentences: [{ n: 1 }, { n: 2 }, { n: 3 }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } },
      { status: 'fulfilled', value: { sentences: [{ n: 4 }, { n: 5 }, { n: 6 }], usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 } } },
    ]
    const { enriched, warnings, usage } = mergeChunkResults(results, chunksAB)
    assert.strictEqual(enriched.length, 6)
    assert.deepStrictEqual(enriched.map((e) => e.n), [1, 2, 3, 4, 5, 6])
    assert.strictEqual(warnings.length, 0)
    assert.deepStrictEqual(usage, { prompt_tokens: 18, completion_tokens: 9, total_tokens: 27 })
  }

  // ── ALIGNMENT: a short batch nulls its tail, does NOT shift ─────
  {
    const results = [
      { status: 'fulfilled', value: { sentences: [{ n: 1 }, { n: 2 }, { n: 3 }] } },
      { status: 'fulfilled', value: { sentences: [{ n: 4 }, { n: 5 }] } }, // batch 2 short by one
    ]
    const { enriched, warnings } = mergeChunkResults(results, chunksAB)
    assert.strictEqual(enriched.length, 6)
    assert.deepStrictEqual(enriched.slice(0, 3).map((e) => e.n), [1, 2, 3], 'batch 1 must not shift')
    assert.strictEqual(enriched[3].n, 4)
    assert.strictEqual(enriched[4].n, 5)
    assert.strictEqual(enriched[5], null) // missing 6th line degrades to null, not a shift-up
    assert.ok(warnings.some((w) => w.includes('批次 2/2 返回数量异常')))
  }

  // ── ALIGNMENT: an overflowing batch drops its extras ───────────
  {
    const results = [
      { status: 'fulfilled', value: { sentences: [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 99 }] } }, // 4 for 3
      { status: 'fulfilled', value: { sentences: [{ n: 4 }, { n: 5 }, { n: 6 }] } },
    ]
    const { enriched, warnings } = mergeChunkResults(results, chunksAB)
    assert.strictEqual(enriched.length, 6)
    assert.deepStrictEqual(enriched.map((e) => e.n), [1, 2, 3, 4, 5, 6], 'extra 99 dropped, batch 2 intact')
    assert.ok(warnings.some((w) => w.includes('批次 1/2 返回数量异常')))
  }

  // ── DEGRADATION: a failed batch → all-null + warning, others ok ─
  {
    const results = [
      { status: 'rejected', reason: new Error('LLM 500') },
      { status: 'fulfilled', value: { sentences: [{ n: 4 }, { n: 5 }, { n: 6 }] } },
    ]
    const { enriched, warnings } = mergeChunkResults(results, chunksAB)
    assert.strictEqual(enriched.length, 6)
    assert.deepStrictEqual(enriched.slice(0, 3), [null, null, null])
    assert.deepStrictEqual(enriched.slice(3).map((e) => e.n), [4, 5, 6], 'surviving batch keeps its lines')
    assert.ok(warnings.some((w) => w.includes('批次 1/2 失败: LLM 500')))
  }

  // ── DEGRADATION: total failure → every slot null ───────────────
  {
    const results = [
      { status: 'rejected', reason: new Error('down') },
      { status: 'rejected', reason: new Error('down') },
    ]
    const { enriched, warnings } = mergeChunkResults(results, chunksAB)
    assert.strictEqual(enriched.length, 6)
    assert.ok(enriched.every((e) => e === null))
    assert.strictEqual(warnings.length, 2)
  }

  console.log('parse helpers ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
