import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatMs, MIN_SAMPLES_FOR_P95, percentile, summarize } from '@/lib/measure/stats'

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

test('nearest-rank percentile returns a value that was actually observed', () => {
  const samples = [10, 20, 30, 40, 50]
  for (const k of [1, 25, 50, 75, 95, 100]) {
    assert.ok(samples.includes(percentile(samples, k)!), `p${k} was not an observed sample`)
  }
})

test('p50 of 1..100 is the 50th value by nearest rank', () => {
  assert.equal(percentile(range(100), 50), 50)
  assert.equal(percentile(range(100), 95), 95)
  assert.equal(percentile(range(100), 100), 100)
})

test('percentile is order independent', () => {
  assert.equal(percentile([50, 10, 40, 20, 30], 50), percentile([10, 20, 30, 40, 50], 50))
})

test('percentile does not mutate its input', () => {
  const samples = [3, 1, 2]
  percentile(samples, 50)
  assert.deepEqual(samples, [3, 1, 2])
})

test('an empty sample set yields null, never zero', () => {
  assert.equal(percentile([], 50), null)
  const empty = summarize([])
  assert.deepEqual(empty, { n: 0, min: null, p50: null, p95: null, max: null, mean: null })
})

test('p95 is withheld below the sample floor rather than reported as the maximum', () => {
  const few = summarize(range(MIN_SAMPLES_FOR_P95 - 1))
  assert.equal(few.p95, null, 'a p95 from too few samples must not be printed')
  assert.notEqual(few.p50, null, 'p50 is still meaningful at this n')
  assert.equal(few.max, MIN_SAMPLES_FOR_P95 - 1)

  const enough = summarize(range(MIN_SAMPLES_FOR_P95))
  assert.notEqual(enough.p95, null)
})

test('at the sample floor p95 is no longer just the largest observation', () => {
  // The reason the floor is 20: below it, nearest-rank p95 and max are the same number, so a
  // printed p95 would carry no information the max did not already carry.
  const atFloor = summarize(range(MIN_SAMPLES_FOR_P95))
  assert.notEqual(atFloor.p95, atFloor.max, 'p95 and max coincide, so the floor is too low')
})

test('summarize reports the sample count so a reader can judge the numbers', () => {
  assert.equal(summarize([1, 2, 3]).n, 3)
})

test('a withheld p95 renders as the reason it was withheld', () => {
  assert.equal(formatMs(null, 7), 'n/a (n=7)')
  assert.equal(formatMs(1449.6, 30), '1450ms')
})
