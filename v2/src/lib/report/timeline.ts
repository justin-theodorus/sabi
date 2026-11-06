// The report's emotion timeline: one reading per turn, along a real clock.
//
// v1's therapist page counted 1fps DeepFace rows into "neutral 62%, happy 21%" and drew that as a
// share chart (therapist/sessions/[sessionId]/page.tsx:88-96, :98). It stored `session_offset_ms`
// on every row and never read it, so the one thing a clinician actually wants — WHEN the learner
// was struggling — was the one thing the chart could not show.
//
// v2 has no 1fps rows to count and does not need any. Phase 3 stores the per-turn aggregate on the
// npc_response payload, which is strictly more informative than a session-wide percentage: it
// carries the descriptor, the model's label, the intensity, the arc the signals traced, and how
// many samples it was drawn from. The time axis comes from session_events.created_at, which is
// real rather than reconstructed.

import { recordOf } from '@/lib/expression/session-summary'
import type { ExpressionDescriptor, LearnerEmotion } from '@/lib/expression/types'
import type { SessionEventRow } from '@/lib/session/types'

export interface EmotionPoint {
  readonly turnIndex: number
  /** Milliseconds since the session's first event, so the axis is the session's own clock. */
  readonly atMs: number
  readonly summaryEmotion: ExpressionDescriptor
  /** The model's label for the same window. Null when it declined to give one. */
  readonly learnerEmotion: LearnerEmotion | null
  /** 0..1, the mean of the strongest signal. Intensity, not confidence. */
  readonly avgScore: number
  /** The arc: "smile 0.44 -> 0.04, brow tension 0.21 -> 0.68, over 14s across 13 samples". */
  readonly explanation: string
  readonly sampleCount: number
  /** What the NPC was feeling on the same turn. `confused` is where a breakdown happened. */
  readonly npcEmotion: string
  /** True when the NPC spoke into silence, so there is no learner message beside this reading. */
  readonly npcInitiated: boolean
}

export interface EmotionTimeline {
  readonly points: readonly EmotionPoint[]
  /** Every NPC turn, including those with no face. The denominator of "visible for N of M". */
  readonly npcTurns: number
  readonly totalSamples: number
}

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : -1)

export function buildEmotionTimeline(events: readonly SessionEventRow[]): EmotionTimeline {
  const npcEvents = events.filter((event) => event.type === 'npc_response')
  if (events.length === 0) return { points: [], npcTurns: 0, totalSamples: 0 }

  const start = events[0].createdAt.getTime()
  const points: EmotionPoint[] = []

  for (const event of npcEvents) {
    const record = recordOf(event.payload)
    // A turn the learner sat through with no camera, no permission or no face is simply absent
    // from the timeline. Drawing it as neutral would be inventing an observation — which is what
    // v1's expression-service did on every error path (expression-service/main.py:91-93).
    if (!record) continue

    points.push({
      turnIndex: asNumber(event.payload.turnIndex),
      atMs: event.createdAt.getTime() - start,
      summaryEmotion: record.summaryEmotion,
      learnerEmotion: record.learnerEmotion ?? null,
      avgScore: record.avgScore,
      explanation: record.explanation,
      sampleCount: record.sampleCount,
      npcEmotion: asString(event.payload.npcEmotion, 'neutral'),
      npcInitiated: event.payload.npcInitiated === true,
    })
  }

  return {
    points,
    npcTurns: npcEvents.length,
    totalSamples: points.reduce((total, point) => total + point.sampleCount, 0),
  }
}
