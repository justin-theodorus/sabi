// One scoring call. Structured output, no fabricated fields, no silent middle.

import { generateText, Output } from 'ai'

import { measureModelCall, type ModelCallMeasurement } from '@/lib/ai/measure'

import { MODEL_TIMEOUT_MS, scoringModel } from '@/lib/ai/model'
import type { ScenarioId } from '@/lib/prompt/types'
import { buildScoringPrompt, SCORING_INSTRUCTIONS } from '@/lib/scoring/prompt'
import { competenceScoresSchema, type CompetenceScoreResult } from '@/lib/scoring/schema'
import { countLearnerTurns, type ScoringTurn } from '@/lib/scoring/transcript'
import type { LanguageModel } from 'ai'

/**
 * v1 used 400 (main.py:781) and Phase 2 used 500, which is ample for the object itself — the
 * scored response is ~170 tokens of text.
 *
 * The headroom is for reasoning models. Measured while comparing models for finding 2.22: Claude
 * Sonnet 5 runs adaptive thinking by default and spent 336 of a 500-token budget on reasoning
 * before being cut off at `finishReason: 'length'`, which surfaced as NoObjectGeneratedError ->
 * `malformed_output` and, correctly, no score at all. A ceiling is not a spend — you are billed
 * for tokens produced — so raising it costs nothing on a model that does not think, and scoring is
 * offline anyway, which is the whole reason a bigger model is on the table here.
 */
const MAX_OUTPUT_TOKENS = 2_000

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
  /**
   * Phase 5. Optional so the eval harness and the tests compile unchanged; supplied by
   * runScoring, which is the only caller that has a session to attribute the cost to.
   */
  readonly onMeasured?: (measurement: ModelCallMeasurement) => void
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

  const model = args.model ?? scoringModel()
  const startedAt = performance.now()

  const result = await generateText({
    model,
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

  // Measured BEFORE `output` is read, because reading it throws on a malformed response and a
  // call that produced no usable score still cost real tokens. A cost that only gets recorded
  // when the call succeeds is a cost that understates itself exactly when it matters.
  args.onMeasured?.(
    measureModelCall({
      route: 'scoring',
      requestedModelId: typeof model === 'string' ? model : model.modelId,
      totalMs: performance.now() - startedAt,
      usage: result.usage,
      performance: result.steps[result.steps.length - 1]?.performance,
      providerMetadata: result.providerMetadata,
      finishReason: result.finishReason,
    }),
  )

  // `output` is a getter that throws when the model produced nothing usable. Reading it here
  // keeps the failure inside this function rather than at some later property access.
  return result.output
}
