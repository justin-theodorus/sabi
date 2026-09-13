import { after, NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError, parseBody, requireSession } from '@/lib/http'
import { classifyPersona, countRePrompts, personaConfidence } from '@/lib/persona/classify'
import { runScoring } from '@/lib/scoring/run-scoring'
import { MIN_SCOREABLE_TURNS } from '@/lib/scoring/score-session'
import {
  appendEvent,
  endSession,
  loadAllEvents,
  setScoringState,
} from '@/lib/session/repository'
import { END_REASONS, type SessionEventRow } from '@/lib/session/types'

export const runtime = 'nodejs'
// The response goes out immediately; the scoring call below it runs inside the same invocation and
// is therefore bounded by this number. Route segment config has to be a literal, so the scoring
// side keeps its own copy — see ROUTE_MAX_DURATION_MS in lib/scoring/run-scoring.ts, which is what
// stops a retry from outliving the invocation and stranding the row at scoring_state 'running'.
export const maxDuration = 60

const DEFAULT_ICONS_PER_MESSAGE = 2 // session/page.tsx:402

const bodySchema = z.object({
  reason: z.enum(END_REASONS),
})

const iconSelections = (events: readonly SessionEventRow[]) =>
  events.filter((event) => event.type === 'icon_selection')

/**
 * Metrics for the persona classifier, derived from the event log rather than from counters the
 * browser kept. v1 accumulated these in refs (latencySamplesRef, iconCountSamplesRef) that died
 * with the tab, and hardcoded re_prompt_count to 0 (session/page.tsx:407), which killed two of
 * the classifier's five branches (finding 2.13).
 */
function sessionMetrics(events: readonly SessionEventRow[]) {
  const selections = iconSelections(events)
  const iconsPerTurn = selections.map((event) => (event.payload.icons as string[] | undefined) ?? [])

  // Learner think time: from the NPC's reply landing to the learner submitting.
  const latencies: number[] = []
  for (let i = 1; i < events.length; i++) {
    if (events[i].type !== 'icon_selection' || events[i - 1].type !== 'npc_response') continue
    latencies.push(events[i].createdAt.getTime() - events[i - 1].createdAt.getTime())
  }

  const mean = (xs: number[], fallback: number) =>
    xs.length === 0 ? fallback : xs.reduce((a, b) => a + b, 0) / xs.length

  return {
    avgResponseLatencyMs: mean(latencies, 0),
    avgIconsPerMessage: mean(iconsPerTurn.map((i) => i.length), DEFAULT_ICONS_PER_MESSAGE),
    rePromptCount: countRePrompts(iconsPerTurn),
    turnCount: selections.length,
  }
}

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
