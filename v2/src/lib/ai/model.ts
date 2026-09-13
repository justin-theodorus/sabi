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
 * Scoring runs after the session has ended, so latency does not matter here the way it does on a
 * turn a child is waiting through. It stays on Haiku for Phase 2 regardless, so the eval suite
 * characterises the same model v1 ran; finding 2.22 and the model choice itself are revisited at
 * Phase 4 with the evals in hand.
 */
export const scoringModel = (): LanguageModel => dialogueModel()

/**
 * No model call in v1 had a timeout at any of its six call sites (finding S5), so a hung call
 * held one of three semaphore slots for up to 150 seconds. A full taxonomy of model errors is
 * Phase 2; a timeout is cheap enough to not defer.
 */
export const MODEL_TIMEOUT_MS = 30_000
