// The eval harness's own logic, tested without a model call.
//
// Lives under src/ so `npm test` runs it; the runner it belongs to lives in evals/ so `npm test`
// does not run THAT and a push never spends money.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { assertEvals, MAX_STDDEV, TIER_MARGIN } from '@/../evals/assertions'
import type { Fixture, FixtureRun, Tier } from '@/../evals/types'
import { SCORE_DIMENSIONS, type ScoreDimension } from '@/lib/scoring/schema'

const fixture = (id: string, tier: Tier, pairs: Fixture['expect']['dimensionsAbove'] = []): Fixture => ({
  id,
  tier,
  scenarioId: 'hawker_centre',
  mode: 'learning',
  intent: 'test',
  events: [],
  expect: { dimensionsAbove: pairs },
})

/** A run where every dimension is `base`, unless overridden. */
const run = (base: number, overrides: Partial<Record<ScoreDimension, number | null>> = {}) => {
  const scores = Object.fromEntries(
    SCORE_DIMENSIONS.map((key) => [key, key in overrides ? overrides[key] : base]),
  ) as Record<ScoreDimension, number | null>
  const observed = SCORE_DIMENSIONS.map((k) => scores[k]).filter((v): v is number => v !== null)
  const overall =
    observed.length === 0 ? null : observed.reduce((t, v) => t + v, 0) / observed.length
  return { scores, overall, summary: 's' }
}

const result = (
  id: string,
  tier: Tier,
  runs: ReturnType<typeof run>[],
  error?: string,
): FixtureRun => ({ fixtureId: id, tier, runs, error })

const check = (report: ReturnType<typeof assertEvals>, name: string) =>
  report.checks.find((c) => c.name.includes(name))

const HEALTHY = {
  fixtures: [fixture('s1', 'strong'), fixture('m1', 'mixed'), fixture('w1', 'weak')],
  results: [
    result('s1', 'strong', [run(80), run(78), run(82)]),
    result('m1', 'mixed', [run(55), run(58), run(52)]),
    result('w1', 'weak', [run(25), run(28), run(22)]),
  ],
}

test('a well-separated set passes every check', () => {
  const report = assertEvals(HEALTHY.fixtures, HEALTHY.results)
  assert.equal(report.passed, true, JSON.stringify(report.checks.filter((c) => !c.passed)))
})

test('a flat scorer fails, even though its tier ordering is untestable', () => {
  // This is v1's failure mode: a perfectly well-formed row of identical invented numbers.
  const flat = [
    result('s1', 'strong', [run(50), run(50), run(50)]),
    result('m1', 'mixed', [run(50), run(50), run(50)]),
    result('w1', 'weak', [run(50), run(50), run(50)]),
  ]

  const report = assertEvals(HEALTHY.fixtures, flat)
  assert.equal(report.passed, false)
  assert.equal(check(report, 'scorer uses the range')?.passed, false)
  assert.equal(check(report, 'strong scores above mixed')?.passed, false)
})

test('tiers that order correctly but by too small a margin fail', () => {
  const narrow = [
    result('s1', 'strong', [run(52)]),
    result('m1', 'mixed', [run(50)]),
    result('w1', 'weak', [run(48)]),
  ]

  const report = assertEvals(HEALTHY.fixtures, narrow)
  assert.equal(check(report, 'strong scores above mixed')?.passed, false)
  assert.ok(TIER_MARGIN > 2)
})

test('inverted tiers fail', () => {
  const inverted = [
    result('s1', 'strong', [run(20)]),
    result('m1', 'mixed', [run(50)]),
    result('w1', 'weak', [run(80)]),
  ]

  const report = assertEvals(HEALTHY.fixtures, inverted)
  assert.equal(check(report, 'strong scores above mixed')?.passed, false)
  assert.equal(check(report, 'mixed scores above weak')?.passed, false)
})

test('dimension separation is asserted per fixture, not across the set', () => {
  const fixtures = [fixture('sep', 'strong', [['social', 'linguistic']])]

  const passing = assertEvals(fixtures, [
    result('sep', 'strong', [run(60, { social: 85, linguistic: 40 })]),
  ])
  assert.equal(check(passing, 'social above linguistic')?.passed, true)

  const failing = assertEvals(fixtures, [
    result('sep', 'strong', [run(60, { social: 40, linguistic: 85 })]),
  ])
  assert.equal(check(failing, 'social above linguistic')?.passed, false)
})

test('a fixture that could not be scored is reported, not skipped', () => {
  const report = assertEvals(HEALTHY.fixtures, [
    result('s1', 'strong', [], 'malformed_output'),
    ...HEALTHY.results.slice(1),
  ])

  assert.equal(report.passed, false)
  const scored = check(report, 'every fixture scored')
  assert.equal(scored?.passed, false)
  assert.match(scored?.detail ?? '', /s1 \(malformed_output\)/)
})

test('an unstable fixture fails the stability band', () => {
  const report = assertEvals(HEALTHY.fixtures, [
    result('s1', 'strong', [run(20), run(80), run(50)]),
    ...HEALTHY.results.slice(1),
  ])

  assert.equal(check(report, 's1: stable across runs')?.passed, false)
  assert.ok(MAX_STDDEV > 0)
})

test('an out-of-range score fails even if the schema somehow let it through', () => {
  const report = assertEvals(HEALTHY.fixtures, [
    result('s1', 'strong', [run(80, { operational: 4000 })]),
    ...HEALTHY.results.slice(1),
  ])

  assert.equal(check(report, 'within 0-100')?.passed, false)
})

test('a single-run fixture is not asserted for stability', () => {
  const report = assertEvals([fixture('one', 'strong')], [result('one', 'strong', [run(70)])])
  assert.equal(check(report, 'one: stable across runs'), undefined)
})

// ── Not observed vs not demonstrated ─────────────────────────────────────────

const observedFixture = (
  id: string,
  tier: Tier,
  expect: Fixture['expect'],
): Fixture => ({ ...fixture(id, tier), expect })

test('a dimension every run declined satisfies notObserved', () => {
  const report = assertEvals(
    [observedFixture('s1', 'strong', { notObserved: ['strategic'] })],
    [result('s1', 'strong', [run(80, { strategic: null }), run(78, { strategic: null })])],
  )
  assert.equal(check(report, 'strategic is not observed')?.passed, true)
})

test('notObserved fails when any run scored the dimension anyway', () => {
  // The half that stops the change being unfalsifiable: two runs out of three declining is not
  // the scorer applying the rule, it is the scorer being inconsistent.
  const report = assertEvals(
    [observedFixture('s1', 'strong', { notObserved: ['strategic'] })],
    [result('s1', 'strong', [run(80, { strategic: null }), run(80, { strategic: 12 })])],
  )
  const found = check(report, 'strategic is not observed')
  assert.equal(found?.passed, false)
  assert.match(found?.detail ?? '', /1\/2 runs scored it/)
})

test('observed fails when the scorer declines a dimension the transcript gives evidence for', () => {
  // mixed-01's shape: the NPC signals confusion three times and the learner repeats itself. That
  // is a low score, not an absence of opportunity, and "not observed" must not become a way out.
  const report = assertEvals(
    [observedFixture('m1', 'mixed', { observed: ['strategic'] })],
    [result('m1', 'mixed', [run(45, { strategic: null }), run(45, { strategic: 15 })])],
  )
  assert.equal(check(report, 'strategic is observed')?.passed, false)
})

test('a dimensionsAbove pair that cannot be evaluated fails rather than silently passing', () => {
  const report = assertEvals(
    [fixture('s1', 'strong', [['social', 'strategic']])],
    [result('s1', 'strong', [run(80, { strategic: null })])],
  )
  const found = check(report, 'social above strategic')
  assert.equal(found?.passed, false)
  assert.match(found?.detail ?? '', /not observed/)
})

test('a not-observed dimension is left out of the range and spread checks', () => {
  const report = assertEvals(
    [fixture('s1', 'strong'), fixture('w1', 'weak')],
    [
      result('s1', 'strong', [run(90, { strategic: null })]),
      result('w1', 'weak', [run(10, { strategic: null })]),
    ],
  )
  assert.equal(check(report, 'all scores within')?.passed, true)
  assert.equal(check(report, 'uses the range')?.detail, 'observed spread 80 across all dimensions (need 20)')
})
