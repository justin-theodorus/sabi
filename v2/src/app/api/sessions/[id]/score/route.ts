import { NextResponse } from 'next/server'

import { jsonError, requireSession } from '@/lib/http'
import { runScoring } from '@/lib/scoring/run-scoring'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Scores a finished session across the five AAC competence dimensions.
 *
 * Ported from v1 /score-session (main.py:736-808) with the two defects that made it dangerous
 * removed:
 *
 * 1. v1 asked for JSON in the prose, stripped markdown fences by hand (:786-789), and then filled
 *    every missing dimension with `float(scores.get(k, 50))` (:793-797). A response carrying only
 *    a summary produced a complete, plausible, entirely fabricated 50/50/50/50/50 clinical record,
 *    which was rendered on a therapist's radar chart and fed back into the next session's prompt
 *    to calibrate difficulty (:390-407). Here the schema is enforced by the provider and validated
 *    on the way back, and a response that fails it produces NO score.
 *
 * 2. v1 ran this from the browser and let the browser write the result to the database
 *    (therapist/sessions/[sessionId]/page.tsx:233). The write happens server-side, in the same
 *    request that produced it.
 *
 * As of Phase 4 this route is no longer how scoring normally fires — POST /end schedules it in an
 * after() callback, so it happens even if the learner closes the tab. This stays as the retry
 * path, and it stays cookie-gated: the report is public to READ, and putting a paid model call
 * behind an unauthenticated URL would be a different thing entirely.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession({ allowEnded: true })
  if (!auth.ok) return auth.response

  const { id } = await params
  if (id !== auth.session.id) return jsonError(403, 'session mismatch')

  // Scoring a live session would grade half a conversation and cache the result.
  if (auth.session.status === 'active') return jsonError(409, 'session is still active')

  // Idempotent: v1 re-scored on every therapist page mount whenever the previous attempt failed.
  if (auth.session.competenceScores !== null) {
    return NextResponse.json({ scores: auth.session.competenceScores, cached: true })
  }

  const outcome = await runScoring({
    sessionId: auth.session.id,
    scenarioId: auth.session.scenarioId,
  })

  if (outcome.kind === 'scored') return NextResponse.json({ scores: outcome.scores, cached: false })

  if (outcome.kind === 'skipped') {
    return jsonError(422, 'not enough turns to score', { learnerTurns: outcome.learnerTurns })
  }

  return jsonError(outcome.errorKind === 'malformed_output' ? 422 : 503, 'scoring failed', {
    kind: outcome.errorKind,
    retryable: outcome.retryable,
  })
}
