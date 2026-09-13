// The per-session emotion line handed to the scorer.
//
// v1 built this in the browser by counting 1fps rows into "neutral 62%, happy 21%"
// (frontend/src/app/therapist/sessions/[sessionId]/page.tsx:88-96) and then wrote it back to the
// database from the same click. Percentages over a whole session lose the thing a clinician cares
// about, which is when the learner was struggling. This reports the arc turn by turn instead, and
// it is derived server-side from the event log rather than sent up by a client.

import type { LearnerExpressionRecord, SessionEventRow } from '@/lib/session/types'

/**
 * Pulls the expression record off an npc_response payload, or null.
 *
 * Exported because the Phase 4 report timeline reads the same field and must apply the same guard:
 * `learnerExpression` is optional on the type (rows written before Phase 3 have no such key) and
 * the payload itself is untyped jsonb.
 */
export function recordOf(payload: Record<string, unknown>): LearnerExpressionRecord | null {
  const value = payload.learnerExpression
  if (value === null || typeof value !== 'object') return null
  const record = value as Partial<LearnerExpressionRecord>
  return typeof record.summaryEmotion === 'string'
    ? (value as LearnerExpressionRecord)
    : null
}

/**
 * Null when no turn in the session carried a face. The scoring prompt already renders that as
 * "Not available", which is what every session recorded before Phase 3 will read as.
 */
export function buildEmotionSummary(events: readonly SessionEventRow[]): string | null {
  const npcTurns = events.filter((event) => event.type === 'npc_response')
  const records = npcTurns
    .map((event) => recordOf(event.payload))
    .filter((record): record is LearnerExpressionRecord => record !== null)

  if (records.length === 0) return null

  const byTurn = records
    .map((record) => `${record.summaryEmotion} (${record.learnerEmotion ?? 'unlabelled'})`)
    .join(', ')

  return `Face visible for ${records.length} of ${npcTurns.length} turns. By turn: ${byTurn}.`
}
