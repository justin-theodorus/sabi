import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

/**
 * Where model calls go.
 *
 * Default is Vercel AI Gateway, which is the choice that matters: it reports tokens and cost per
 * request with no instrumentation, which is what Phase 5 needs, and it makes "compare a bigger
 * model for scoring" a string change rather than a code change. On Vercel, OIDC authenticates it
 * and there is no key in the environment at all.
 *
 * The gateway refuses requests until the Vercel team has a card on file, so
 * SABI_MODEL_PROVIDER=anthropic routes straight to Anthropic with ANTHROPIC_API_KEY instead. The
 * AI SDK abstracts the provider, so this is the whole of the difference — nothing downstream
 * knows which path it took.
 */
export type ModelProvider = 'gateway' | 'anthropic'

const GATEWAY_MODEL = 'anthropic/claude-haiku-4.5'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

export const modelProvider = (): ModelProvider =>
  process.env.SABI_MODEL_PROVIDER === 'anthropic' ? 'anthropic' : 'gateway'

/**
 * Haiku 4.5 for the interactive path, matching v1 (main.py:554). Latency is the constraint on a
 * turn a child is waiting through. Phase 4 revisits the model for /score-session specifically,
 * which is offline and latency-insensitive (finding 2.22), with the eval suite in hand.
 */
export function dialogueModel(): LanguageModel {
  if (modelProvider() === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('SABI_MODEL_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set')
    return createAnthropic({ apiKey })(ANTHROPIC_MODEL)
  }

  // A bare model id resolves through the gateway, authenticated by VERCEL_OIDC_TOKEN on Vercel
  // or AI_GATEWAY_API_KEY locally.
  return GATEWAY_MODEL
}

/**
 * The scoring model, which is its own decision rather than an alias of the dialogue model's.
 *
 * Finding 2.22: v1 used `claude-haiku-4-5` at all six call sites including /score-session
 * (main.py:778), with no comment anywhere saying why. Haiku is right for the interactive path
 * because latency is the constraint on a turn a child is waiting through. Scoring is offline, runs
 * once per session, and is a rubric-based clinical judgement over a whole transcript, so it is the
 * one call where a larger model would cost almost nothing and might plausibly matter.
 *
 * Splitting the constant is what makes that answerable instead of arguable: `npm run eval --
 * --model=<id>` runs the whole suite against any model and writes a result file naming it.
 *
 * MEASURED, Phase 4, both runs committed under evals/results/ and both 25/25:
 *
 *                              Haiku 4.5        Sonnet 5
 *   strong - mixed margin      15.5             15.9
 *   mixed - weak margin        45.8             33.8
 *   worst per-fixture sd       2.6              4.6
 *   "not observed" applied     3/3 fixtures,    1/3 fixtures consistently; split runs
 *                              all runs         on the other two
 *   $/MTok in-out              1 / 5            2 / 10, plus ~340 reasoning tokens a call
 *
 * So: Haiku stays. The larger model matched it on the one margin that was close, was WORSE on
 * the other two and on run-to-run stability, and was less consistent on exactly the judgement
 * this phase added — it declined `strategic` on some runs of a transcript and scored it on others.
 * The honest conclusion for finding 2.22 is that the model was never the weak part of this call.
 * The rubric was: it told the scorer to punish a session in which nothing went wrong, and fixing
 * that moved the numbers far more than changing the model did.
 */
const SCORING_GATEWAY_MODEL = 'anthropic/claude-haiku-4.5'
const SCORING_ANTHROPIC_MODEL = 'claude-haiku-4-5'

/** What the scorer will actually call, as a string, for logs and eval result headers. */
export const scoringModelId = (): string =>
  process.env.SABI_SCORING_MODEL ??
  (modelProvider() === 'anthropic' ? SCORING_ANTHROPIC_MODEL : SCORING_GATEWAY_MODEL)

export function scoringModel(): LanguageModel {
  const id = scoringModelId()

  if (modelProvider() === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('SABI_MODEL_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set')
    return createAnthropic({ apiKey })(id)
  }

  return id
}

/**
 * No model call in v1 had a timeout at any of its six call sites (finding S5), so a hung call
 * held one of three semaphore slots for up to 150 seconds. A full taxonomy of model errors is
 * Phase 2; a timeout is cheap enough to not defer.
 */
export const MODEL_TIMEOUT_MS = 30_000
