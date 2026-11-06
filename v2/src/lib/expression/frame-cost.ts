// Per-frame landmarker cost, summarised.
//
// The arithmetic lives here rather than in use-expression-sampler.ts for the reason
// lib/report/view.ts:3-5 already gives: the sampler is a 'use client' hook, the test runner only
// matches src/**/*.test.ts, and there is no React test renderer — so logic inside the hook is
// logic nobody can assert on.
//
// What this answers: the rebuild plan's "client-side emotion inference cost per frame". v1 could
// not have answered it at all, because inference ran on a 2GB DeepFace pod behind a network hop
// (expression-service/main.py), so the per-frame cost there was a round trip, not a computation.

import { MIN_SAMPLES_FOR_P95, percentile } from '@/lib/measure/stats'
import type { FrameInferenceStats } from '@/lib/expression/types'

/** Truncated so one long window cannot grow the payload without bound. 20 minutes at 1 Hz. */
export const MAX_FRAME_TIMINGS = 1_200

export interface FrameCostDevice {
  readonly device: string
  readonly cores: number
}

/** How many characters of user agent are worth keeping. Enough to name a machine, not to track. */
const MAX_DEVICE_CHARS = 200

/**
 * Summarises a window of per-frame durations.
 *
 * Returns null for an empty window rather than a zeroed record: a turn where the camera was off
 * and a turn where inference was instantaneous are different facts, and only one of them is
 * plausible.
 */
export function summarizeFrameCost(
  timings: readonly number[],
  device: FrameCostDevice,
): FrameInferenceStats | null {
  const usable = timings.filter((ms) => Number.isFinite(ms) && ms >= 0)
  if (usable.length === 0) return null

  return {
    n: usable.length,
    p50: round2(percentile(usable, 50)!),
    p95: usable.length >= MIN_SAMPLES_FOR_P95 ? round2(percentile(usable, 95)!) : null,
    max: round2(Math.max(...usable)),
    device: device.device.slice(0, MAX_DEVICE_CHARS),
    cores: Number.isFinite(device.cores) ? Math.max(0, Math.trunc(device.cores)) : 0,
  }
}

/** Sub-millisecond precision is real here — the spike measured 8.4ms — but nanoseconds are noise. */
const round2 = (ms: number): number => Math.round(ms * 100) / 100

/** Reads the device out of the browser. Called only from client code; kept beside the summary. */
export const describeDevice = (): FrameCostDevice => ({
  device: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
  cores: typeof navigator === 'undefined' ? 0 : (navigator.hardwareConcurrency ?? 0),
})
