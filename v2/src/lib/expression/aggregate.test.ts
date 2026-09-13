import { test } from 'node:test'
import assert from 'node:assert/strict'

import { summarizeExpression } from '@/lib/expression/aggregate'
import { ZERO_SIGNALS } from '@/lib/expression/signals'
import type { ExpressionSample, SignalKey } from '@/lib/expression/types'

const SAMPLE_MS = 1_000

/** One sample per second, which is what the capture loop produces. */
const window = (frames: readonly Partial<Record<SignalKey, number>>[]): ExpressionSample[] =>
  frames.map((signals, index) => ({
    at: index * SAMPLE_MS,
    signals: { ...ZERO_SIGNALS, ...signals },
  }))

const repeat = (n: number, signals: Partial<Record<SignalKey, number>>) =>
  window(Array.from({ length: n }, () => signals))

// ── No window at all ─────────────────────────────────────────────────────────

test('returns null for an empty window so the prompt drops the branch entirely', () => {
  assert.equal(summarizeExpression([]), null)
})

// ── Descriptors ──────────────────────────────────────────────────────────────

test('reads a sustained smile as relaxed', () => {
  const summary = summarizeExpression(repeat(9, { smile: 0.8 }))
  assert.equal(summary?.summaryEmotion, 'relaxed')
  assert.equal(summary?.avgScore, 0.8)
})

test('reads sustained brow tension as tense', () => {
  assert.equal(summarizeExpression(repeat(9, { browDown: 0.6 }))?.summaryEmotion, 'tense')
})

test('reads a dropped mouth as downcast', () => {
  assert.equal(summarizeExpression(repeat(9, { frown: 0.5 }))?.summaryEmotion, 'downcast')
})

test('reads wide eyes as startled and narrowed eyes as focused', () => {
  assert.equal(summarizeExpression(repeat(9, { eyeWide: 0.7 }))?.summaryEmotion, 'startled')
  assert.equal(summarizeExpression(repeat(9, { eyeSquint: 0.7 }))?.summaryEmotion, 'focused')
})

test('reads a resting face as still rather than inventing the signal that happens to drift highest', () => {
  const summary = summarizeExpression(repeat(9, { smile: 0.05, browDown: 0.04 }))
  assert.equal(summary?.summaryEmotion, 'still')
})

test('reads two signals in a dead heat as animated rather than picking a winner by noise', () => {
  const summary = summarizeExpression(repeat(9, { smile: 0.4, jawOpen: 0.36 }))
  assert.equal(summary?.summaryEmotion, 'animated')
})

test('reads a face that kept leaving the frame as unreadable, not as calm', () => {
  // Three samples spanning twenty seconds: the learner looked away for most of the turn. v1's
  // service returned neutral at 100% for exactly this case (expression-service/main.py:91-93),
  // so "looking away" and "calm" produced the same record.
  const sparse: ExpressionSample[] = [
    { at: 0, signals: { ...ZERO_SIGNALS, smile: 0.8 } },
    { at: 1_000, signals: { ...ZERO_SIGNALS, smile: 0.8 } },
    { at: 20_000, signals: { ...ZERO_SIGNALS, smile: 0.8 } },
  ]
  const summary = summarizeExpression(sparse)
  assert.equal(summary?.summaryEmotion, 'unreadable')
  assert.equal(summary?.avgScore, 0)
})

// ── The progression, which is the part worth keeping from v1 ─────────────────

test('reports a start and an end, not a point sample', () => {
  const rising = window([
    { browDown: 0.1 },
    { browDown: 0.2 },
    { browDown: 0.2 },
    { browDown: 0.4 },
    { browDown: 0.6 },
    { browDown: 0.6 },
    { browDown: 0.7 },
    { browDown: 0.8 },
    { browDown: 0.9 },
  ])
  const summary = summarizeExpression(rising)
  assert.equal(summary?.summaryEmotion, 'tense')
  // Leading third 0.1/0.2/0.2, trailing third 0.7/0.8/0.9.
  assert.match(summary!.explanation, /brow tension 0\.17 -> 0\.8/)
  assert.match(summary!.explanation, /over 8s across 9 samples/)
})

test('a smile that fades and a brow that rises both survive into the explanation', () => {
  const summary = summarizeExpression(
    window([
      { smile: 0.9, browDown: 0.0 },
      { smile: 0.9, browDown: 0.0 },
      { smile: 0.9, browDown: 0.0 },
      { smile: 0.5, browDown: 0.3 },
      { smile: 0.2, browDown: 0.5 },
      { smile: 0.1, browDown: 0.7 },
      { smile: 0.0, browDown: 0.8 },
      { smile: 0.0, browDown: 0.8 },
      { smile: 0.0, browDown: 0.8 },
    ]),
  )
  assert.match(summary!.explanation, /smile 0\.9 -> 0/)
  assert.match(summary!.explanation, /brow tension 0 -> 0\.8/)
})

test('names at most three signals, so the prompt addition stays small', () => {
  const busy = repeat(9, {
    smile: 0.9,
    browDown: 0.8,
    jawOpen: 0.7,
    eyeWide: 0.6,
    frown: 0.5,
    mouthPress: 0.4,
  })
  assert.equal(summarizeExpression(busy)!.explanation.split(' -> ').length - 1, 3)
})

test('says so plainly when nothing cleared the noise floor', () => {
  assert.match(summarizeExpression(repeat(5, { smile: 0.02 }))!.explanation, /^no marked expression/)
})

// ── Degenerate windows ───────────────────────────────────────────────────────

test('handles a single sample without pretending it has an arc', () => {
  const summary = summarizeExpression(window([{ smile: 0.8 }]))
  assert.equal(summary?.summaryEmotion, 'relaxed')
  assert.match(summary!.explanation, /smile 0\.8 -> 0\.8, over 1s across 1 sample$/)
})

test('handles two samples, where there is no third to split on', () => {
  const summary = summarizeExpression(window([{ jawOpen: 0.6 }, { jawOpen: 0.8 }]))
  assert.equal(summary?.summaryEmotion, 'startled')
  assert.match(summary!.explanation, /jaw open 0\.7 -> 0\.7/)
})
