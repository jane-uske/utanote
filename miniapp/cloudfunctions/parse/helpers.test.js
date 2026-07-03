const assert = require('assert')
const { extractJSON, chunk, runWithConcurrency, mergeChunkResults, looksJapanese } = require('./helpers')

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
