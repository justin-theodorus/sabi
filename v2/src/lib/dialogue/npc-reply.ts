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
//
// `learnerEmotion` (Phase 3) sits between the two for the same reason: it is the record of how the
// learner seemed this turn, it feeds the report and the scoring prompt, and after `reply` it would
// be the first thing a truncated response lost. It costs two short fields ahead of the prose.
// Phase 2 measured that moving `reply` to the front did NOT recover TTFT (1925ms median against a
// 1650-1949ms range), so field order is not the lever latency turns on here.
//
// Phase 5 MEASURED WHAT IT ACTUALLY COSTS, per call rather than by comparing two runs on different
// days. Every dialogue call now records both the model's first token and the first token a learner
// can see, so the price of these short fields is the difference between two numbers on the same
// request: 696ms to the model's first token, 1002ms to the learner's, so **306ms at p50** spent
// emitting `{"emotion":"…","farewell":…` before the prose begins (MEASUREMENTS.md section 2.4).
//
// That is a real cost, it sits inside Phase 2's estimated 200-500ms, and the fields stay anyway:
// each one exists because the alternative was deriving the same signal from the finished prose,
// which is finding 2.9 and finding S11. 306ms buys the deletion of two whole classes of guessing.
//
// `farewell` (Phase 4) is the same move a third time, for finding S11. v1 decided the conversation
// was over by searching the finished prose for a scenario-specific substring
// (FAREWELL_MARKERS, main.py:506-511) — `queue_shop`'s list included 'sorry' and 'alright', words a
// defensive NPC says constantly and early, and a scenario id outside the four-key dict got an
// empty list and could never complete at all. It is the same brittleness class as 2.9, and the
// same answer applies: the model already knows whether it just said goodbye, so ask it in the call
// that is already happening instead of guessing from the output afterwards. It is a single boolean
// ahead of the prose, and its share of the 306ms above is measured rather than assumed.

import { z } from 'zod'

import { LEARNER_EMOTIONS } from '@/lib/expression/types'
import { NPC_EMOTIONS, type NpcEmotion } from '@/lib/prompt/types'

export const npcReplySchema = z.object({
  emotion: z
    .enum(NPC_EMOTIONS)
    .describe(
      'How YOU, the character speaking, feel as you say this line. Not how the learner feels.',
    ),
  // nullish, not nullable: an omitted label must not fail the whole turn. `reply` is what the
  // learner is waiting for; this field is a record for the report and the scorer. Treating a
  // missing one as a malformed response would trade a working turn for a data point.
  learnerEmotion: z
    .enum(LEARNER_EMOTIONS)
    .nullish()
    .describe(
      'How the LEARNER seems, read only from the OBSERVABLE EXPRESSION line in your ' +
        'instructions. Null if that line is absent.',
    ),
  // Not nullish, unlike learnerEmotion: the model always knows whether it is ending the
  // conversation, there is no "the line was absent" case to be generous about, and a missing
  // value here would silently read as "keep going" — which is the stranding S11 describes.
  farewell: z
    .boolean()
    .describe(
      'True only if this line ends the conversation: you have said goodbye, handed the food ' +
        'over, or otherwise concluded. False if you are still talking to the learner.',
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
