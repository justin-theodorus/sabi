// The NPC turn as structured output: the emotion the model itself is expressing, plus the line
// it says. This is the fix for finding 2.9.
//
// v1 decided the emotion after the fact, by keyword-matching the finished prose
// (dialogue-engine/main.py:487-504). The branches ran sad -> confused -> mad -> surprised ->
// happy and the `confused` branch matched the bare substring "?", while the system prompt tells
// the NPC to "Ask only ONE thing at a time" (main.py:463). Nine of ten replies in the Phase 1
// end-to-end run came back "confused". The sprite was frozen and `is_repair` was near-constant
// true in a therapist-facing log.
//
// The comment at main.py:489 gives the motivation for the heuristic outright — "no extra Claude
// call" — and that tradeoff is worth keeping. So the emotion is asked for in the dialogue call
// that is already happening, as a schema-enforced enum rather than a guess about the prose.
//
// `emotion` is declared FIRST on purpose. The model emits the object in field order, so the
// emotion lands before any prose and the sprite can change as the NPC starts speaking. It also
// means a reply truncated by maxOutputTokens (256) still carries its emotion, which a trailing
// marker would not.

import { z } from 'zod'

import { NPC_EMOTIONS, type NpcEmotion } from '@/lib/prompt/types'

export const npcReplySchema = z.object({
  emotion: z
    .enum(NPC_EMOTIONS)
    .describe(
      'How YOU, the character speaking, feel as you say this line. Not how the learner feels.',
    ),
  reply: z
    .string()
    .describe('The line you say out loud, following every rule in your instructions.'),
})

export type NpcReply = z.infer<typeof npcReplySchema>

/** Used when the model never produced a usable emotion. See `DEFAULT_EMOTION` below. */
export const isNpcEmotion = (value: unknown): value is NpcEmotion =>
  typeof value === 'string' && (NPC_EMOTIONS as readonly string[]).includes(value)

/**
 * Deliberately not a fall back to v1's keyword classifier. Degrading to a function that answers
 * "confused" nine times in ten would reintroduce 2.9 on the failure path and hide it there.
 */
export const DEFAULT_EMOTION: NpcEmotion = 'neutral'

export interface PartialReplyState {
  /** How much of `reply` has already been written to the client. */
  readonly sentChars: number
  readonly emotion: NpcEmotion | null
}

export const INITIAL_PARTIAL_STATE: PartialReplyState = { sentChars: 0, emotion: null }

export interface PartialReplyStep {
  readonly state: PartialReplyState
  /** Text not yet sent. Empty when the partial added no prose. */
  readonly delta: string
  /** Set only on the step that first resolves a valid emotion, so the caller emits it once. */
  readonly emotion: NpcEmotion | null
}

/**
 * Turns one partial object from `partialOutputStream` into the text delta still owed to the
 * client.
 *
 * Partials are NOT schema-validated while streaming — `partial.emotion` is observably the prefix
 * `"ha"` one chunk before it is `"happy"` — so the enum is checked here rather than trusted.
 */
export function advancePartialReply(
  state: PartialReplyState,
  partial: { readonly emotion?: unknown; readonly reply?: unknown },
): PartialReplyStep {
  const emotion =
    state.emotion === null && isNpcEmotion(partial.emotion) ? partial.emotion : null

  const reply = typeof partial.reply === 'string' ? partial.reply : ''
  const delta = reply.length > state.sentChars ? reply.slice(state.sentChars) : ''

  return {
    state: {
      sentChars: state.sentChars + delta.length,
      emotion: emotion ?? state.emotion,
    },
    delta,
    emotion,
  }
}
