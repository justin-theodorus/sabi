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

/** A frame cannot plausibly take longer than this; anything above it is a broken clock. */
const MAX_FRAME_MS = 60_000

/** Cap on the user agent, which is the one string this file's opening rule is broken for. */
const MAX_DEVICE_CHARS = 200

/**
 * Phase 5. What the landmarker cost per frame, on the device that ran it.
 *
 * `device` is caller-supplied free text, which everything above this line argues against — so it
 * gets the argument it deserves rather than an exception. It exists because "8ms per frame" is
 * not a checkable claim without a machine attached, and it is admissible here because it is
 * write-only with respect to the model: it is inserted into the `npc_response` jsonb payload and
 * read by MEASUREMENTS.md, and nothing carries it toward a prompt. Verified rather than asserted:
 * toModelMessages (lib/dialogue/history.ts) reads only `payload.translated` and `payload.content`,
 * and buildSystemPrompt never receives a payload at all.
 *
 * It is bounded anyway, on the same principle as `at` above: unbounded input is unbounded input
 * whether or not today's code path happens to be safe.
 */
export const frameInferenceSchema = z
  .object({
    n: z.number().int().min(0).max(100_000),
    p50: z.number().min(0).max(MAX_FRAME_MS),
    p95: z.number().min(0).max(MAX_FRAME_MS).nullable(),
    max: z.number().min(0).max(MAX_FRAME_MS),
    device: z.string().max(MAX_DEVICE_CHARS),
    cores: z.number().int().min(0).max(1_024),
  })
  .nullable()
  .default(null)
