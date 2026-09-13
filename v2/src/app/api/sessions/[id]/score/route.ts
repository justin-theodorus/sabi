import { NextResponse } from 'next/server'

import { classifyModelError } from '@/lib/ai/errors'
import { jsonError, requireSession } from '@/lib/http'
import { NotEnoughTurnsError, scoreSession } from '@/lib/scoring/score-session'
import { buildScoringTranscript } from '@/lib/scoring/transcript'
import { loadAllEvents, saveCompetenceScores } from '@/lib/session/repository'

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
 *    a summary produced a complete, plausible, fabricated 50/50/50/50/50 clinical record, which
 *    was rendered on a therapist's radar chart and fed back into the next session's prompt to
 *    calibrate difficulty (:390-407). Here the schema is enforced by the provider and validated on
 *    the way back, and a response that fails it produces NO score.
 *
 * 2. v1 ran this from the browser and let the browser write the result to the database
 *    (therapist/sessions/[sessionId]/page.tsx:233). The write happens here, server-side, in the
 *    same request that produced it.
 *
 * Phase 4 renders the result; this route only produces and stores it.
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

  const turns = buildScoringTranscript(await loadAllEvents(auth.session.id))

  try {
    const scores = await scoreSession({ scenarioId: auth.session.scenarioId, turns })
    await saveCompetenceScores(auth.session.id, scores)

    return NextResponse.json({ scores, cached: false })
  } catch (error) {
    if (error instanceof NotEnoughTurnsError) {
      return jsonError(422, 'not enough turns to score', { learnerTurns: error.turns })
    }

    const classified = classifyModelError(error)
    console.error(`[score] ${classified.kind}: ${classified.log}`)

    // Nothing is written. An absent score is recoverable; an invented one is not.
    return jsonError(classified.kind === 'malformed_output' ? 422 : 503, 'scoring failed', {
      kind: classified.kind,
      retryable: classified.retryable,
    })
  }
}
