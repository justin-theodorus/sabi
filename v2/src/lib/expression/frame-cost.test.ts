import assert from 'node:assert/strict'
import { test } from 'node:test'

import { summarizeFrameCost } from '@/lib/expression/frame-cost'
import { MIN_SAMPLES_FOR_P95 } from '@/lib/measure/stats'

const DEVICE = { device: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', cores: 10 }
const timings = (n: number, ms = 8) => Array.from({ length: n }, () => ms)

test('a window of frames summarises to a count and a median', () => {
  const stats = summarizeFrameCost([8, 9, 7, 8.4, 12], DEVICE)!
  assert.equal(stats.n, 5)
  assert.equal(stats.p50, 8.4)
  assert.equal(stats.max, 12)
  assert.equal(stats.cores, 10)
})

test('an empty window is null, not a zeroed record', () => {
  // A turn with the camera off and a turn with instant inference are different facts.
  assert.equal(summarizeFrameCost([], DEVICE), null)
})

test('p95 is withheld below the sample floor', () => {
  assert.equal(summarizeFrameCost(timings(MIN_SAMPLES_FOR_P95 - 1), DEVICE)!.p95, null)
  assert.notEqual(summarizeFrameCost(timings(MIN_SAMPLES_FOR_P95), DEVICE)!.p95, null)
})

test('junk timings are dropped rather than poisoning the median', () => {
  const stats = summarizeFrameCost([8, Number.NaN, 9, Number.POSITIVE_INFINITY, -3, 10], DEVICE)!
  assert.equal(stats.n, 3, 'only the three finite non-negative samples count')
  assert.equal(stats.p50, 9)
})

test('a window of only junk is null rather than a fabricated zero', () => {
  assert.equal(summarizeFrameCost([Number.NaN, -1], DEVICE), null)
})

test('durations keep sub-millisecond precision but not nanosecond noise', () => {
  // The MediaPipe spike measured 8.4ms, so rounding to whole milliseconds would erase the finding.
  const stats = summarizeFrameCost([8.4166666, 8.4166666, 8.4166666], DEVICE)!
  assert.equal(stats.p50, 8.42)
})

test('the user agent is truncated, so a long one cannot bloat every turn payload', () => {
  const stats = summarizeFrameCost([8], { device: 'x'.repeat(5_000), cores: 8 })!
  assert.ok(stats.device.length <= 200)
})

test('a nonsense core count degrades to zero rather than reaching the database', () => {
  assert.equal(summarizeFrameCost([8], { device: 'ua', cores: Number.NaN })!.cores, 0)
  assert.equal(summarizeFrameCost([8], { device: 'ua', cores: -4 })!.cores, 0)
})
