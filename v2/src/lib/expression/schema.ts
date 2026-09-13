// The wire contract for expression samples.
//
// Everything the client sends is a bounded number. No caller-supplied string reaches the system
// prompt: the descriptor and the explanation are both formatted server-side from these numbers.
//
// Bounded, not merely typed. `explanation` interpolates the window's duration, so an unbounded
// `at` would let a caller choose part of the prompt's text ("over 9007199254740s") without ever
// sending a string. Numeric input into a prompt is still input into a prompt.
// That keeps the position taken on finding S6 in Phase 2 — custom_npc_prompt was dropped rather
// than sanitised, and activeEvent and availableIcons were moved to server-side scenario config —
// intact now that the client has something new to say.
//
// v1 had no cap here. A 60-second turn sent 60 unsummarised lines into a 150-token call
// (frontend/src/lib/emotion-summary.ts:38-42), which is the same unbounded-input shape as S5.

import { z } from 'zod'

import { SIGNAL_KEYS } from '@/lib/expression/types'

/** One minute of samples at 1 Hz. The reducer drops oldest first past this, so a long compose
 *  keeps the most recent minute rather than growing without limit. */
export const MAX_EXPRESSION_SAMPLES = 60

/** Ceiling on a sample's age within its window. Generous — a window is normally under a minute,
 *  and stays under this even when the face is intermittent enough to stretch 60 samples out. */
export const MAX_SAMPLE_AGE_MS = 600_000

const unit = z.number().min(0).max(1)

const signalsSchema = z.object(
  Object.fromEntries(SIGNAL_KEYS.map((key) => [key, unit])) as Record<
    (typeof SIGNAL_KEYS)[number],
    typeof unit
  >,
)

export const expressionSampleSchema = z.object({
  at: z.number().int().min(0).max(MAX_SAMPLE_AGE_MS),
  signals: signalsSchema,
})

export const expressionWindowSchema = z
  .array(expressionSampleSchema)
  .max(MAX_EXPRESSION_SAMPLES)
  .nullable()
  .default(null)
