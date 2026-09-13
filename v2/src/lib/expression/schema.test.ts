import { test } from 'node:test'
import assert from 'node:assert/strict'

import { summarizeExpression } from '@/lib/expression/aggregate'
import {
  expressionWindowSchema,
  MAX_EXPRESSION_SAMPLES,
  MAX_SAMPLE_AGE_MS,
} from '@/lib/expression/schema'
import { ZERO_SIGNALS } from '@/lib/expression/signals'

const sample = (at: number, signals: Record<string, number> = ZERO_SIGNALS) => ({ at, signals })

test('an absent window parses to null, which is what a camera-less session sends', () => {
  assert.deepEqual(expressionWindowSchema.parse(undefined), null)
  assert.deepEqual(expressionWindowSchema.parse(null), null)
})

test('rejects a signal outside the unit interval', () => {
  for (const bad of [1.5, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = expressionWindowSchema.safeParse([sample(0, { ...ZERO_SIGNALS, smile: bad })])
    assert.equal(result.success, false, String(bad))
  }
})

test('rejects a window with a signal missing, so the vector is always full length', () => {
  const incomplete: Record<string, number> = { ...ZERO_SIGNALS }
  delete incomplete.smile
  assert.equal(expressionWindowSchema.safeParse([{ at: 0, signals: incomplete }]).success, false)
})

test('rejects more samples than the reducer would ever accumulate', () => {
  const tooMany = Array.from({ length: MAX_EXPRESSION_SAMPLES + 1 }, (_, i) => sample(i * 1000))
  assert.equal(expressionWindowSchema.safeParse(tooMany).success, false)
  assert.equal(expressionWindowSchema.safeParse(tooMany.slice(1)).success, true)
})

test('bounds `at`, because the duration it implies is interpolated into the system prompt', () => {
  // Typed is not the same as bounded. `explanation` renders the window's span, so an unbounded
  // `at` lets a caller choose part of the prompt's text without ever sending a string.
  assert.equal(expressionWindowSchema.safeParse([sample(Number.MAX_SAFE_INTEGER)]).success, false)
  assert.equal(expressionWindowSchema.safeParse([sample(MAX_SAMPLE_AGE_MS + 1)]).success, false)
  assert.equal(expressionWindowSchema.safeParse([sample(MAX_SAMPLE_AGE_MS)]).success, true)
  assert.equal(expressionWindowSchema.safeParse([sample(-1)]).success, false)
  assert.equal(expressionWindowSchema.safeParse([sample(1.5)]).success, false)
})

test('the worst window the schema allows still renders a bounded prompt line', () => {
  const parsed = expressionWindowSchema.parse([
    sample(0, { ...ZERO_SIGNALS, smile: 1 }),
    sample(MAX_SAMPLE_AGE_MS, { ...ZERO_SIGNALS, smile: 1 }),
  ])
  const summary = summarizeExpression(parsed!)
  assert.match(summary!.explanation, /over 600s across 2 samples$/)
})
