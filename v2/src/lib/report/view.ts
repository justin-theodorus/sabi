// Everything the report page renders, assembled from the session row and its event log.
//
// Pure and testable, because the .tsx that renders it is not: v2 has no React test renderer and
// adding one is not this phase's work. Anything the report DECIDES belongs here; the components
// only lay it out.

import { buildEmotionTimeline, type EmotionTimeline } from '@/lib/report/timeline'
import {
  competenceScoresSchema,
  overallScore,
  type CompetenceScoreResult,
} from '@/lib/scoring/schema'
import { buildScoringTranscript, countLearnerTurns, type ScoringTurn } from '@/lib/scoring/transcript'
import type { EndReason, SessionEventRow, SessionRow } from '@/lib/session/types'

/**
 * What the report can say about the score, and nothing else.
 *
 * Four states rather than "scored or not" because a public page can only say what the row says,
 * and "not scored yet" told to a reader whose scoring failed permanently is a lie that never
 * expires. Migration 0003 exists for this.
 */
export type ScoringView =
  | { readonly state: 'scored'; readonly scores: CompetenceScoreResult; readonly overall: number | null }
  | { readonly state: 'running' }
  | { readonly state: 'skipped'; readonly learnerTurns: number }
  | { readonly state: 'failed'; readonly errorKind: string | null }
  /** The session has not ended. Nothing has been scored because there is nothing final to score. */
  | { readonly state: 'unscored' }

export interface ReportView {
  readonly sessionId: string
  readonly scenarioId: string
  readonly mode: string
  readonly status: SessionRow['status']
  readonly endReason: EndReason | null
  readonly startedAt: Date
  readonly endedAt: Date | null
  readonly durationMs: number | null
  readonly turnCount: number
  readonly heartsRemaining: number
  readonly transcript: readonly ScoringTurn[]
  readonly timeline: EmotionTimeline
  readonly scoring: ScoringView
}

function scoringView(session: SessionRow, learnerTurns: number): ScoringView {
  if (session.competenceScores !== null) {
    const parsed = competenceScoresSchema.safeParse(session.competenceScores)
    // A stored payload that no longer satisfies the schema is a failure, not something to render
    // around. v1's whole class of bug was showing a therapist numbers nobody had validated.
    if (!parsed.success) return { state: 'failed', errorKind: 'malformed_output' }
    return { state: 'scored', scores: parsed.data, overall: overallScore(parsed.data) }
  }

  if (session.status === 'active') return { state: 'unscored' }

  switch (session.scoringState) {
    case 'running':
      return { state: 'running' }
    case 'skipped':
      return { state: 'skipped', learnerTurns }
    case 'failed':
      return { state: 'failed', errorKind: session.scoringError }
    default:
      // 'pending' on an ended session means it finished before scoring was wired up, or the
      // invocation died before after() ran. Either way nobody is coming back for it.
      return { state: 'failed', errorKind: null }
  }
}

export function buildReport(session: SessionRow, events: readonly SessionEventRow[]): ReportView {
  const transcript = buildScoringTranscript(events)
  const learnerTurns = countLearnerTurns(transcript)

  return {
    sessionId: session.id,
    scenarioId: session.scenarioId,
    mode: session.mode,
    status: session.status,
    endReason: session.endReason,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs:
      session.endedAt === null ? null : session.endedAt.getTime() - session.startedAt.getTime(),
    turnCount: learnerTurns,
    heartsRemaining: session.hearts,
    transcript,
    timeline: buildEmotionTimeline(events),
    scoring: scoringView(session, learnerTurns),
  }
}

/** What the headline says the session's ending was. `null` while it is still running. */
export const endingLabel = (view: ReportView): string => {
  if (view.status === 'active') return 'Still in progress'
  switch (view.endReason) {
    case 'farewell':
      return 'Completed'
    case 'turn_cap':
      return 'Reached the turn limit'
    case 'hearts_exhausted':
      return 'Ran out of hearts'
    case 'manual':
      return 'Ended early'
    default:
      return 'Ended'
  }
}
