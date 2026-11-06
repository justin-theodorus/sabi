import { test } from 'node:test'
import assert from 'node:assert/strict'

import { classifyPersona, countRePrompts, personaConfidence } from '@/lib/persona/classify'

const metrics = (latency: number, rePrompts: number, icons: number) => ({
  avgResponseLatencyMs: latency,
  rePromptCount: rePrompts,
  avgIconsPerMessage: icons,
})

const persona = (latency: number, rePrompts: number, icons: number) =>
  classifyPersona(metrics(latency, rePrompts, icons)).persona

// ── The five branches, in order ──────────────────────────────────────────────

test('high latency alone gives shy_chick', () => {
  assert.equal(persona(25_000, 0, 3), 'shy_chick')
})

test('many re-prompts alone gives shy_chick even when fast', () => {
  // Unreachable in v1, where the only caller hardcoded rePromptCount to 0. Finding 2.13.
  assert.equal(persona(3_000, 4, 1), 'shy_chick')
})

test('fast with simple combos gives zippy_sotong', () => {
  assert.equal(persona(4_000, 0, 1), 'zippy_sotong')
})

test('brisk with few re-prompts and rich combos gives garang_crab', () => {
  assert.equal(persona(8_000, 1, 3), 'garang_crab')
})

test('re-prompts push a would-be garang_crab down to curious_monkey', () => {
  // Also unreachable in v1 for the same reason.
  assert.equal(persona(8_000, 2, 3), 'curious_monkey')
})

test('moderate pace with at least two icons gives curious_monkey', () => {
  assert.equal(persona(12_000, 0, 2), 'curious_monkey')
})

test('everything else falls through to steady_turtle', () => {
  assert.equal(persona(12_000, 0, 1), 'steady_turtle')
})

// ── Boundaries and reachability ──────────────────────────────────────────────

test('the 15s to 20s band always yields steady_turtle regardless of icon count', () => {
  for (const icons of [0, 1, 2, 3, 8]) {
    assert.equal(persona(17_000, 0, icons), 'steady_turtle', `icons=${icons}`)
  }
})

test('garang_crab is unreachable below three icons', () => {
  assert.notEqual(persona(6_000, 0, 2), 'garang_crab')
})

test('thresholds are strict, so a latency exactly on a bound misses that branch', () => {
  // 20000 is not > 20000, so not shy_chick; it is then below no other bound, so it lands in the
  // same dead zone as 17000 above.
  assert.equal(persona(20_000, 0, 3), 'steady_turtle')
  // 5000 is not < 5000, so not zippy_sotong; icons < 2 rules out the remaining branches.
  assert.equal(persona(5_000, 0, 1), 'steady_turtle')
})

// ── Confidence ───────────────────────────────────────────────────────────────

test('confidence decays linearly to zero at sixty seconds', () => {
  assert.equal(personaConfidence(0), 1)
  assert.equal(personaConfidence(30_000), 0.5)
  assert.equal(personaConfidence(60_000), 0)
})

test('confidence clamps rather than going negative', () => {
  assert.equal(personaConfidence(120_000), 0)
})

// ── countRePrompts, the 2.13 fix ─────────────────────────────────────────────

test('counts nothing for a single turn', () => {
  assert.equal(countRePrompts([['i', 'want', 'rice']]), 0)
})

test('counts nothing when consecutive turns share no icons', () => {
  assert.equal(countRePrompts([['i', 'want', 'rice'], ['thank', 'you']]), 0)
})

test('counts a turn that fully repeats the previous one', () => {
  assert.equal(countRePrompts([['i', 'want', 'rice'], ['i', 'want', 'rice']]), 1)
})

test('counts a turn that reuses exactly half of its icons', () => {
  assert.equal(countRePrompts([['i', 'want'], ['i', 'rice']]), 1)
})

test('does not count a turn that reuses less than half of its icons', () => {
  assert.equal(countRePrompts([['i'], ['i', 'want', 'chicken rice']]), 0)
})

test('counts each repair in a run of them', () => {
  assert.equal(countRePrompts([['rice'], ['rice'], ['rice'], ['noodle']]), 2)
})

test('measures overlap on distinct icons, so repetition within a turn does not inflate it', () => {
  assert.equal(countRePrompts([['rice', 'rice', 'rice'], ['rice', 'rice', 'rice']]), 1)
})

test('skips empty turns instead of dividing by zero', () => {
  assert.equal(countRePrompts([[], ['rice'], []]), 0)
})
