import { after, NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError, parseBody, requireSession } from '@/lib/http'
import { classifyPersona, personaConfidence } from '@/lib/persona/classify'
import { runScoring } from '@/lib/scoring/run-scoring'
import { sessionMetrics } from '@/lib/session/metrics'
import { MIN_SCOREABLE_TURNS } from '@/lib/scoring/score-session'
import {
  appendEvent,
  endSession,
  loadAllEvents,
  setScoringState,
} from '@/lib/session/repository'
import { END_REASONS } from '@/lib/session/types'

export const runtime = 'nodejs'
// The response goes out immediately; the scoring call below it runs inside the same invocation and
// is therefore bounded by this number. Route segment config has to be a literal, so the scoring
// side keeps its own copy — see ROUTE_MAX_DURATION_MS in lib/scoring/run-scoring.ts, which is what
// stops a retry from outliving the invocation and stranding the row at scoring_state 'running'.
export const maxDuration = 60

const bodySchema = z.object({
  reason: z.enum(END_REASONS),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (id !== auth.session.id) return jsonError(403, 'session mismatch')

  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response

  const events = await loadAllEvents(auth.session.id)
  const metrics = sessionMetrics(events)

  // A session with no learner turn produced no signal, so there is nothing to classify. v1
  // guarded the same way (session/page.tsx:399) and it is the honest answer.
  const classification = metrics.turnCount > 0 ? classifyPersona(metrics) : null

  await appendEvent(auth.session.id, 'session_end', {
    reason: body.data.reason,
    ...metrics,
    personaClassified: classification?.persona ?? null,
    personaReason: classification?.reason ?? null,
    personaConfidence: classification ? personaConfidence(metrics.avgResponseLatencyMs) : null,
  })

  const ended = await endSession({
    sessionId: auth.session.id,
    reason: body.data.reason,
    personaClassified: classification?.persona ?? null,
  })

  /**
   * Scoring fires here, after the response has flushed, rather than from the browser.
   *
   * `after()` runs the callback once the response is sent but still inside this invocation, which
   * buys three things at once: the learner gets the report link with no wait behind a model call,
   * the scoring still happens if they close the tab a second later, and the paid call stays behind
   * the httpOnly cookie even though the report it produces is public to read.
   *
   * Below MIN_SCOREABLE_TURNS there is nothing to grade, so the state is set directly and no model
   * call is made at all — the report says "too short to score", which is true and is not a failure.
   */
  const scoreable = metrics.turnCount >= MIN_SCOREABLE_TURNS
  if (scoreable) {
    await setScoringState(auth.session.id, 'running')
    after(() => runScoring({ sessionId: auth.session.id, scenarioId: auth.session.scenarioId }))
  } else {
    await setScoringState(auth.session.id, 'skipped')
  }

  return NextResponse.json({
    sessionId: auth.session.id,
    endReason: body.data.reason,
    hearts: ended?.hearts ?? auth.session.hearts,
    turnCount: metrics.turnCount,
    persona: auth.session.persona,
    personaClassified: classification?.persona ?? null,
    personaReason: classification?.reason ?? null,
    reportUrl: `/report/${auth.session.id}`,
    scoring: scoreable ? ('running' as const) : ('skipped' as const),
  })
}
