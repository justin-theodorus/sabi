// What the eval set actually asserts.
//
// Pure, so the assertions themselves are unit-tested against synthetic results (assertions.test.ts)
// without spending a cent. A harness whose own logic is untested proves nothing.
//
// The rebuild plan is explicit that these are assertions on ORDERING and on DIMENSION SEPARATION,
// not on exact values. An eval that pins `operational === 72` breaks on every model change and
// tells you nothing about whether the scorer got worse.

import { modelProvider, scoringModelId } from '@/lib/ai/model'
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

const numbers = (values: readonly (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null)

/**
 * The mean of the runs that produced a number for this dimension. Null when every run declined it
 * as not observed, which is a result rather than a zero — see the `strategic` field in
 * lib/scoring/schema.ts.
 */
const dimensionMean = (result: FixtureRun, key: ScoreDimension): number | null => {
  const observed = numbers(result.runs.map((run) => run.scores[key]))
  return observed.length === 0 ? null : mean(observed)
}

const tierMean = (results: readonly FixtureRun[], tier: Tier): number =>
  mean(
    numbers(
      results
        .filter((r) => r.tier === tier && r.runs.length > 0)
        .flatMap((r) => r.runs.map((run) => run.overall)),
    ),
  )

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
      SCORE_DIMENSIONS.filter((key) => {
        const value = run.scores[key]
        return value !== null && (value < 0 || value > 100)
      }).map((key) => `${result.fixtureId}.${key}=${run.scores[key]}`),
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
      // A null on either side means the ordering could not be evaluated at all. That is a failure
      // rather than a skip: the fixture asserted a comparison and did not get one.
      checks.push({
        name: `${fixture.id}: ${higher} above ${lower}`,
        passed: a !== null && b !== null && a > b,
        detail:
          a === null || b === null
            ? `${higher} ${a ?? 'not observed'} vs ${lower} ${b ?? 'not observed'}`
            : `${higher} ${a.toFixed(1)} vs ${lower} ${b.toFixed(1)}`,
      })
    }
  }

  // 4b. Not observed vs not demonstrated. The whole point of making `strategic` nullable: a
  //     session where nothing ever broke must decline the dimension, and a session where the NPC
  //     signalled confusion and the learner never adapted must still score it low. Asserting only
  //     the first half would let the scorer answer "not observed" to everything difficult.
  for (const fixture of fixtures) {
    const result = byId.get(fixture.id)
    if (!result || result.runs.length === 0) continue

    for (const key of fixture.expect.notObserved ?? []) {
      const scored = result.runs.filter((run) => run.scores[key] !== null)
      checks.push({
        name: `${fixture.id}: ${key} is not observed`,
        passed: scored.length === 0,
        detail:
          scored.length === 0
            ? `all ${result.runs.length} runs declined it, as they should — nothing broke`
            : `${scored.length}/${result.runs.length} runs scored it: ${scored.map((r) => r.scores[key]).join(', ')}`,
      })
    }

    for (const key of fixture.expect.observed ?? []) {
      const declined = result.runs.filter((run) => run.scores[key] === null)
      checks.push({
        name: `${fixture.id}: ${key} is observed`,
        passed: declined.length === 0,
        detail:
          declined.length === 0
            ? `scored in all ${result.runs.length} runs (mean ${dimensionMean(result, key)?.toFixed(1)})`
            : `${declined.length}/${result.runs.length} runs declined a dimension the transcript gives evidence for`,
      })
    }
  }

  // 5. Stability. Reported for every fixture; failed only past the band.
  for (const result of results) {
    if (result.runs.length < 2) continue
    const sd = stddev(numbers(result.runs.map((run) => run.overall)))
    checks.push({
      name: `${result.fixtureId}: stable across runs`,
      passed: sd <= MAX_STDDEV,
      detail: `sd ${sd.toFixed(1)} (max ${MAX_STDDEV})`,
    })
  }

  // 6. Not degenerate. If every dimension of every fixture lands on the same number, the scorer is
  //    not discriminating and every check above could still pass by luck.
  const allScores = numbers(
    results.flatMap((r) => r.runs.flatMap((run) => SCORE_DIMENSIONS.map((k) => run.scores[k]))),
  )
  const spread = allScores.length === 0 ? 0 : Math.max(...allScores) - Math.min(...allScores)
  checks.push({
    name: 'scorer uses the range',
    passed: spread >= 20,
    detail: `observed spread ${spread} across all dimensions (need 20)`,
  })

  return {
    startedAt: new Date().toISOString(),
    // The model ID itself, not just the provider. Comparing two runs is the entire point of
    // finding 2.22 and two files that both say "gateway" cannot be compared.
    model: `${scoringModelId()} via ${modelProvider()}`,
    passed: checks.every((check) => check.passed),
    checks,
  }
}
