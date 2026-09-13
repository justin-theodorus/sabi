// What the eval set actually asserts.
//
// Pure, so the assertions themselves are unit-tested against synthetic results (assertions.test.ts)
// without spending a cent. A harness whose own logic is untested proves nothing.
//
// The rebuild plan is explicit that these are assertions on ORDERING and on DIMENSION SEPARATION,
// not on exact values. An eval that pins `operational === 72` breaks on every model change and
// tells you nothing about whether the scorer got worse.

import { SCORE_DIMENSIONS, type ScoreDimension } from '@/lib/scoring/schema'
import type { Fixture, FixtureRun, Tier } from './types'

/** Adjacent tiers must separate by at least this much, averaged. Below it, the scorer is guessing. */
export const TIER_MARGIN = 8

/** A fixture whose overall swings more than this across runs is not reliably scoreable. */
export const MAX_STDDEV = 12

export interface EvalCheck {
  readonly name: string
  readonly passed: boolean
  readonly detail: string
}

export interface EvalReport {
  readonly startedAt: string
  readonly model: string
  readonly passed: boolean
  readonly checks: readonly EvalCheck[]
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

const stddev = (values: readonly number[]): number => {
  if (values.length === 0) return 0
  const avg = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)))
}

const dimensionMean = (result: FixtureRun, key: ScoreDimension): number =>
  mean(result.runs.map((run) => run.scores[key]))

const tierMean = (results: readonly FixtureRun[], tier: Tier): number =>
  mean(results.filter((r) => r.tier === tier && r.runs.length > 0).flatMap((r) => r.runs.map((run) => run.overall)))

export function assertEvals(
  fixtures: readonly Fixture[],
  results: readonly FixtureRun[],
): EvalReport {
  const checks: EvalCheck[] = []
  const byId = new Map(results.map((result) => [result.fixtureId, result]))

  // 1. Schema. Every run produced a valid, complete object. This is the check that would have
  //    caught v1's silent 50/50/50/50/50, which was a well-formed row of invented numbers.
  const failed = results.filter((result) => result.runs.length === 0)
  checks.push({
    name: 'every fixture scored',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${results.length}/${results.length} fixtures returned valid scores`
        : `failed: ${failed.map((f) => `${f.fixtureId} (${f.error})`).join('; ')}`,
  })

  // 2. Range. Schema-enforced, asserted anyway: v1 did float() with no bounds check at all.
  const outOfRange = results.flatMap((result) =>
    result.runs.flatMap((run) =>
      SCORE_DIMENSIONS.filter((key) => run.scores[key] < 0 || run.scores[key] > 100).map(
        (key) => `${result.fixtureId}.${key}=${run.scores[key]}`,
      ),
    ),
  )
  checks.push({
    name: 'all scores within 0-100',
    passed: outOfRange.length === 0,
    detail: outOfRange.length === 0 ? 'all in range' : outOfRange.join(', '),
  })

  // 3. Tier ordering. strong > mixed > weak, by a margin.
  const strong = tierMean(results, 'strong')
  const mixed = tierMean(results, 'mixed')
  const weak = tierMean(results, 'weak')

  checks.push({
    name: 'strong scores above mixed',
    passed: strong - mixed >= TIER_MARGIN,
    detail: `strong ${strong.toFixed(1)} vs mixed ${mixed.toFixed(1)} (need +${TIER_MARGIN})`,
  })
  checks.push({
    name: 'mixed scores above weak',
    passed: mixed - weak >= TIER_MARGIN,
    detail: `mixed ${mixed.toFixed(1)} vs weak ${weak.toFixed(1)} (need +${TIER_MARGIN})`,
  })

  // 4. Dimension separation. The check a flat 50-across-the-board response fails while tier
  //    ordering alone would still pass it.
  for (const fixture of fixtures) {
    const pairs = fixture.expect.dimensionsAbove ?? []
    if (pairs.length === 0) continue

    const result = byId.get(fixture.id)
    if (!result || result.runs.length === 0) continue

    for (const [higher, lower] of pairs) {
      const a = dimensionMean(result, higher)
      const b = dimensionMean(result, lower)
      checks.push({
        name: `${fixture.id}: ${higher} above ${lower}`,
        passed: a > b,
        detail: `${higher} ${a.toFixed(1)} vs ${lower} ${b.toFixed(1)}`,
      })
    }
  }

  // 5. Stability. Reported for every fixture; failed only past the band.
  for (const result of results) {
    if (result.runs.length < 2) continue
    const sd = stddev(result.runs.map((run) => run.overall))
    checks.push({
      name: `${result.fixtureId}: stable across runs`,
      passed: sd <= MAX_STDDEV,
      detail: `sd ${sd.toFixed(1)} (max ${MAX_STDDEV})`,
    })
  }

  // 6. Not degenerate. If every dimension of every fixture lands on the same number, the scorer is
  //    not discriminating and every check above could still pass by luck.
  const allScores = results.flatMap((r) => r.runs.flatMap((run) => SCORE_DIMENSIONS.map((k) => run.scores[k])))
  const spread = allScores.length === 0 ? 0 : Math.max(...allScores) - Math.min(...allScores)
  checks.push({
    name: 'scorer uses the range',
    passed: spread >= 20,
    detail: `observed spread ${spread} across all dimensions (need 20)`,
  })

  return {
    startedAt: new Date().toISOString(),
    model: process.env.SABI_MODEL_PROVIDER === 'anthropic' ? 'anthropic direct' : 'gateway',
    passed: checks.every((check) => check.passed),
    checks,
  }
}
