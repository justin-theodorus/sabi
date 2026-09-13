import assert from 'node:assert/strict'
import { test } from 'node:test'

import { labelAnchor, polarPoint, polygonPoints, scorePath } from '@/lib/report/radar'

const round = ([x, y]: readonly [number, number]) => [Math.round(x), Math.round(y)]

test('the first vertex is at twelve o clock and the rest go clockwise', () => {
  assert.deepEqual(round(polarPoint(100, 100, 50, 0, 4)), [100, 50])
  assert.deepEqual(round(polarPoint(100, 100, 50, 1, 4)), [150, 100])
  assert.deepEqual(round(polarPoint(100, 100, 50, 2, 4)), [100, 150])
  assert.deepEqual(round(polarPoint(100, 100, 50, 3, 4)), [50, 100])
})

test('every vertex sits on the circle of the given radius', () => {
  for (let i = 0; i < 5; i += 1) {
    const [x, y] = polarPoint(130, 130, 82, i, 5)
    const distance = Math.hypot(x - 130, y - 130)
    assert.ok(Math.abs(distance - 82) < 0.001, `vertex ${i} was ${distance} from the centre`)
  }
})

test('a polygon has one point per side', () => {
  assert.equal(polygonPoints(100, 100, 40, 5).split(' ').length, 5)
})

test('labels anchor away from the centre line', () => {
  assert.equal(labelAnchor(10, 100), 'end')
  assert.equal(labelAnchor(190, 100), 'start')
  assert.equal(labelAnchor(101, 100), 'middle')
})

test('the score path closes and has one vertex per scored dimension', () => {
  const path = scorePath([50, 50, 50, 50, 50], 100, 100, 80)
  assert.ok(path.endsWith(' Z'))
  assert.equal(path.split('L').length, 5, 'M plus four L commands')
})

test('a not-observed dimension is skipped, not drawn at the centre', () => {
  // The whole reason the geometry lives here: a spoke pinned to the centre reads as a score of
  // zero, which is the clinical claim the nullable dimension exists to avoid making.
  const withNull = scorePath([80, 80, 80, null, 80], 100, 100, 80)
  const withZero = scorePath([80, 80, 80, 0, 80], 100, 100, 80)

  assert.notEqual(withNull, withZero)
  assert.equal(withNull.split(/[ML]/).length - 1, 4, 'four vertices, not five')
  assert.ok(!withNull.includes('100.0,100.0'), 'nothing is drawn at the centre')
})

test('a fully unobserved set produces no path at all rather than a degenerate one', () => {
  assert.equal(scorePath([null, null, null, null, null], 100, 100, 80), '')
})
