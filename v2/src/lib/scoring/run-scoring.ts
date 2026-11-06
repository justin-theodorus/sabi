// Scoring a finished session, from the event log to the stored result.
//
// Extracted so the two callers cannot drift: POST /api/sessions/[id]/score, which the session's
// own browser can call, and the after() callback in POST /api/sessions/[id]/end, which is how
// scoring actually fires in normal use. v1 had exactly one caller and it was a React effect in a
// therapist's browser (therapist/sessions/[sessionId]/page.tsx:212-233), which both triggered the
// model call and wrote the clinical record it produced.
//
// Every path through here leaves the session in a state a public report can render honestly:
// `scored` with a payload, `skipped` because there was nothing to score, or `failed` with the
// classified error kind. Nothing is ever invented to fill the gap.

import { classifyModelError } from '@/lib/ai/errors'
import { MODEL_TIMEOUT_MS } from '@/lib/ai/model'
import { buildEmotionSummary } from '@/lib/expression/session-summary'
import type { ScenarioId } from '@/lib/prompt/types'
import { NotEnoughTurnsError, scoreSession } from '@/lib/scoring/score-session'
import { competenceScoresSchema, type CompetenceScoreResult } from '@/lib/scoring/schema'
import { buildScoringTranscript } from '@/lib/scoring/transcript'
import {
  loadAllEvents,
  loadSession,
  recordModelCall,
  saveCompetenceScores,
  setScoringState,
} from '@/lib/session/repository'
import type { TurnErrorKind } from '@/lib/turn/types'

export type ScoringOutcome =
  | { readonly kind: 'scored'; readonly scores: CompetenceScoreResult }
  | { readonly kind: 'skipped'; readonly learnerTurns: number }
  | { readonly kind: 'failed'; readonly errorKind: TurnErrorKind; readonly retryable: boolean }

/**
 * One retry, and only for the kinds the taxonomy says are worth retrying. Scoring runs unattended
 * after the response has gone out, so there is nobody to press a button, and a transient 429
 * should not leave a permanent hole in a report.
 */
const RETRY_DELAY_MS = 1_500

/**
 * How long the whole of runScoring may take, and the reason it is bounded at all.
 *
 * This runs inside the end route's `after()` callback, which Next executes within that route's
 * `maxDuration` — 60s, declared literally there because route segment config has to be statically
 * analysable. A model call is bounded by MODEL_TIMEOUT_MS (30s), and `timeout` classifies as
 * retryable (ai/errors.ts:108), so two attempts plus the delay come to 61.5s: past the budget.
 *
 * The consequence was not a lost retry but a wedged row. The invocation would be killed after
 * `setScoringState(id, 'running')` and before any terminal write, leaving `scoring_state` at
 * 'running' with nothing in the system that would ever move it — and the public report telling
 * every future reader "Scoring this session, reload in a few seconds" forever. That is precisely
 * the permanent lie migration 0003 was written to make impossible, reintroduced by the retry.
 *
 * So the retry is conditional on there being room to finish it. The 8s of headroom covers the end
 * route's own work before `after()` fires and the terminal write after the attempt returns.
 */
const ROUTE_MAX_DURATION_MS = 60_000
const HEADROOM_MS = 8_000
export const SCORING_BUDGET_MS = ROUTE_MAX_DURATION_MS - HEADROOM_MS

/** Pure, so the budget rule above is asserted rather than merely described. */
export function shouldRetryScoring(args: {
  readonly retryable: boolean
  readonly attempt: number
  readonly now: number
  readonly deadline: number
}): boolean {
  if (!args.retryable || args.attempt !== 0) return false
  return args.now + RETRY_DELAY_MS + MODEL_TIMEOUT_MS <= args.deadline
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function runScoring(args: {
  readonly sessionId: string
  readonly scenarioId: ScenarioId
}): Promise<ScoringOutcome> {
  const deadline = Date.now() + SCORING_BUDGET_MS
  const events = await loadAllEvents(args.sessionId)
  const turns = buildScoringTranscript(events)
  const emotionSummary = buildEmotionSummary(events)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const scores = await scoreSession({
        scenarioId: args.scenarioId,
        turns,
        emotionSummary,
        // Phase 5. One scoring call per session, and the only model cost a learner never waits
        // on — which is exactly why it would have been the easiest one to leave uncounted.
        onMeasured: (measurement) => void recordModelCall(args.sessionId, measurement),
      })
      const written = await saveCompetenceScores(args.sessionId, scores)
      if (written) return { kind: 'scored', scores }

      // Another scoring run got there first — the write is conditional, so ours was refused rather
      // than allowed to overwrite. Report what is actually stored, not what we computed: a caller
      // handed a score the database does not hold is being told something untrue, however small.
      const stored = await loadSession(args.sessionId)
      const parsed = competenceScoresSchema.safeParse(stored?.competenceScores)
      return parsed.success
        ? { kind: 'scored', scores: parsed.data }
        : { kind: 'failed', errorKind: 'malformed_output', retryable: false }
    } catch (error) {
      if (error instanceof NotEnoughTurnsError) {
        await setScoringState(args.sessionId, 'skipped')
        return { kind: 'skipped', learnerTurns: error.turns }
      }

      const classified = classifyModelError(error)
      console.error(`[score] ${args.sessionId} ${classified.kind}: ${classified.log}`)

      // Retry only if a whole second attempt still fits. Better a recorded failure the reader can
      // see than a row stranded mid-flight by an invocation that ran out of time.
      if (shouldRetryScoring({ retryable: classified.retryable, attempt, now: Date.now(), deadline })) {
        await wait(RETRY_DELAY_MS)
        continue
      }

      // Nothing is written to competence_scores. An absent score is recoverable; an invented one
      // is not, and the report says which of the two it is looking at.
      await setScoringState(args.sessionId, 'failed', classified.kind)
      return { kind: 'failed', errorKind: classified.kind, retryable: classified.retryable }
    }
  }

  // Unreachable: the loop either returns or falls into the failure branch on its second pass.
  await setScoringState(args.sessionId, 'failed', 'stream_failed')
  return { kind: 'failed', errorKind: 'stream_failed', retryable: false }
}
