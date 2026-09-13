// One scoring call. Structured output, no fabricated fields, no silent middle.

import { generateText, Output } from 'ai'

import { MODEL_TIMEOUT_MS, scoringModel } from '@/lib/ai/model'
import type { ScenarioId } from '@/lib/prompt/types'
import { buildScoringPrompt, SCORING_INSTRUCTIONS } from '@/lib/scoring/prompt'
import { competenceScoresSchema, type CompetenceScoreResult } from '@/lib/scoring/schema'
import { countLearnerTurns, type ScoringTurn } from '@/lib/scoring/transcript'
import type { LanguageModel } from 'ai'

const MAX_OUTPUT_TOKENS = 500 // v1 used 400 (main.py:781); the rubric makes the summary longer.

/** Below this there is nothing to score, and a score would be invention rather than measurement. */
export const MIN_SCOREABLE_TURNS = 2

export class NotEnoughTurnsError extends Error {
  constructor(readonly turns: number) {
    super(`session has ${turns} learner turns, need at least ${MIN_SCOREABLE_TURNS}`)
    this.name = 'NotEnoughTurnsError'
  }
}

export interface ScoreSessionArgs {
  readonly scenarioId: ScenarioId
  readonly turns: readonly ScoringTurn[]
  readonly emotionSummary?: string | null
  /** Injected by the tests and the eval harness. */
  readonly model?: LanguageModel
}

/**
 * Throws rather than returning a partial result. A NoObjectGeneratedError from here classifies as
 * `malformed_output` (lib/ai/errors.ts), and the caller's job is to record no score at all.
 *
 * That is the entire difference from v1, which caught the parse failure and filled the gaps with
 * `float(scores.get(k, 50))` five times over.
 */
export async function scoreSession(args: ScoreSessionArgs): Promise<CompetenceScoreResult> {
  const learnerTurns = countLearnerTurns(args.turns)
  if (learnerTurns < MIN_SCOREABLE_TURNS) throw new NotEnoughTurnsError(learnerTurns)

  const result = await generateText({
    model: args.model ?? scoringModel(),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    instructions: SCORING_INSTRUCTIONS,
    prompt: buildScoringPrompt({
      scenarioId: args.scenarioId,
      turns: args.turns,
      emotionSummary: args.emotionSummary,
    }),
    abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    output: Output.object({ schema: competenceScoresSchema }),
  })

  // `output` is a getter that throws when the model produced nothing usable. Reading it here
  // keeps the failure inside this function rather than at some later property access.
  return result.output
}
