// Summary statistics, as pure functions.
//
// This is the smallest module in Phase 5 and the one that decides whether its numbers are honest.
// Three consumers share it: the bench harness's report, the client-side per-frame aggregator, and
// MEASUREMENTS.md. They must agree on what "p95" means, because the whole point of the phase is
// that a number is comparable to another number.
//
// Finding: every performance claim in v1 is a prediction written in a comment
// (sabi-evidence.md:784-791). The failure mode this module guards against is subtler than that —
// a real measurement over too few samples, printed with the same confidence as a real one.

/**
 * Nearest-rank percentile: p[k] is the smallest value at or above which k% of the samples fall.
 *
 * No interpolation. Interpolated percentiles are defensible for large n and actively misleading
 * for small n, where they invent a value that was never observed. Every number this phase prints
 * is a sample that actually happened.
 *
 * Returns null for an empty input rather than 0, for the same reason `cost_usd` is nullable:
 * "no data" and "zero" are different facts and a summary that conflates them is worse than one
 * that declines to answer.
 */
export function percentile(samples: readonly number[], k: number): number | null {
  if (samples.length === 0) return null
  if (k <= 0) return Math.min(...samples)

  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.ceil((k / 100) * sorted.length)
  return sorted[Math.min(rank, sorted.length) - 1]
}

/**
 * Below this many samples a p95 is one of the top one or two observations wearing a percentile's
 * clothes. At n=7, p95 IS the maximum; printing it as "p95" claims a tail estimate that the data
 * cannot support. `summarize` returns null there and the renderer prints `n/a (n=7)`.
 *
 * 20 is the point at which the 95th percentile stops being the single largest sample.
 */
export const MIN_SAMPLES_FOR_P95 = 20

export interface Summary {
  readonly n: number
  readonly min: number | null
  readonly p50: number | null
  /** Null when n < MIN_SAMPLES_FOR_P95. Not 0, and not silently the max. */
  readonly p95: number | null
  readonly max: number | null
  readonly mean: number | null
}

export function summarize(samples: readonly number[]): Summary {
  const n = samples.length
  if (n === 0) return { n: 0, min: null, p50: null, p95: null, max: null, mean: null }

  return {
    n,
    min: Math.min(...samples),
    p50: percentile(samples, 50),
    p95: n >= MIN_SAMPLES_FOR_P95 ? percentile(samples, 95) : null,
    max: Math.max(...samples),
    mean: samples.reduce((a, b) => a + b, 0) / n,
  }
}

/** Renders a summary field for a table, making an absent p95 say why it is absent. */
export const formatMs = (value: number | null, n: number): string =>
  value === null ? `n/a (n=${n})` : `${Math.round(value)}ms`
