import { test } from 'node:test'
import assert from 'node:assert/strict'

import { toSignals, ZERO_SIGNALS, type BlendshapeCategory } from '@/lib/expression/signals'
import { SIGNAL_KEYS } from '@/lib/expression/types'

const cats = (entries: Record<string, number>): BlendshapeCategory[] =>
  Object.entries(entries).map(([categoryName, score]) => ({ categoryName, score }))

test('averages left/right pairs rather than summing them', () => {
  const signals = toSignals(cats({ mouthSmileLeft: 0.9, mouthSmileRight: 0.5 }))
  assert.equal(signals.smile, 0.7)
})

test('keeps every signal on the landmarker 0-1 scale even when both sides max out', () => {
  const signals = toSignals(cats({ browDownLeft: 1, browDownRight: 1 }))
  assert.equal(signals.browDown, 1)
})

test('reads single-source signals straight through', () => {
  assert.equal(toSignals(cats({ jawOpen: 0.42 })).jawOpen, 0.42)
  assert.equal(toSignals(cats({ browInnerUp: 0.3 })).browInnerUp, 0.3)
})

test('treats a blendshape the model did not report as zero, not as missing', () => {
  const signals = toSignals(cats({ mouthSmileLeft: 1 }))
  assert.equal(signals.smile, 0.5)
  assert.equal(signals.jawOpen, 0)
  assert.deepEqual(Object.keys(signals).sort(), [...SIGNAL_KEYS].sort())
})

test('always returns the same fixed-length vector, so the wire schema can be exact', () => {
  assert.deepEqual(toSignals([]), ZERO_SIGNALS)
  assert.equal(Object.keys(toSignals([])).length, SIGNAL_KEYS.length)
})

test('ignores blendshapes outside the ten kept signals', () => {
  assert.deepEqual(toSignals(cats({ eyeLookDownLeft: 1, tongueOut: 1 })), ZERO_SIGNALS)
})

test('discards a non-finite score rather than propagating NaN through the mean', () => {
  const signals = toSignals(cats({ mouthSmileLeft: Number.NaN, mouthSmileRight: 0.8 }))
  assert.equal(signals.smile, 0.4)
})

test('clamps out-of-range scores into the unit interval', () => {
  assert.equal(toSignals(cats({ jawOpen: 1.4 })).jawOpen, 1)
  assert.equal(toSignals(cats({ jawOpen: -0.3 })).jawOpen, 0)
})
