// Assembles one NPC turn as a UI message stream.
//
// Split out of the route handler so the streaming and failure behaviour can be tested against a
// mock model with no cookie, no database and no network. That seam is the point: the error
// taxonomy below is asserted by tests rather than by a comment, which is the difference between
// this and v1, whose CI ran with ANTHROPIC_API_KEY=stub and never exercised a model path at all.

import {
  createUIMessageStream,
  Output,
  streamText,
  type InferUIMessageChunk,
  type LanguageModel,
  type ModelMessage,
} from 'ai'

import { classifyModelError } from '@/lib/ai/errors'
import {
  advancePartialReply,
  DEFAULT_EMOTION,
  INITIAL_PARTIAL_STATE,
  npcReplySchema,
  type PartialReplyState,
} from '@/lib/dialogue/npc-reply'
import type { SabiUIMessage, TurnData } from '@/lib/dialogue/stream-types'
import type { LearnerEmotion } from '@/lib/expression/types'
import type { NpcEmotion } from '@/lib/prompt/types'

const TEXT_PART_ID = 'npc-reply'

export interface TurnStreamArgs {
  readonly model: LanguageModel
  readonly instructions: string
  readonly messages: readonly ModelMessage[]
  readonly maxOutputTokens: number
  readonly abortSignal?: AbortSignal
  /**
   * Persists the finished turn and returns what the client is told about it.
   *
   * `learnerEmotion` is null whenever the prompt carried no OBSERVABLE EXPRESSION line — no
   * camera, no permission, or no face for the turn. It is recorded, never fed back into a prompt.
   */
  readonly onReply: (
    reply: string,
    npcEmotion: NpcEmotion,
    learnerEmotion: LearnerEmotion | null,
  ) => Promise<TurnData>
}

export function createTurnStream(
  args: TurnStreamArgs,
): ReadableStream<InferUIMessageChunk<SabiUIMessage>> {
  return createUIMessageStream<SabiUIMessage>({
    execute: async ({ writer }) => {
      // streamText does not throw on a provider failure — the failure becomes an error part in
      // the stream, and the result promises then reject with a NoOutputGeneratedError carrying no
      // cause. This callback is the only place the real error is visible. See lib/ai/errors.ts.
      let captured: unknown = null

      const result = streamText({
        model: args.model,
        maxOutputTokens: args.maxOutputTokens,
        instructions: args.instructions,
        messages: [...args.messages],
        abortSignal: args.abortSignal,
        output: Output.object({ schema: npcReplySchema }),
        onError({ error }) {
          captured = error
        },
      })

      let textOpen = false

      try {
        // With `output` set, result.stream carries raw JSON, so it cannot be merged into the UI
        // stream the way plain text could. We forward the `reply` field ourselves: each partial
        // is the whole object so far, and advancePartialReply diffs it against what has already
        // gone out. The wire parts are identical, so the client is unchanged.
        let state: PartialReplyState = INITIAL_PARTIAL_STATE
        let streamedEmotion: NpcEmotion | null = null

        for await (const partial of result.partialOutputStream) {
          const step = advancePartialReply(state, partial)
          state = step.state

          if (step.emotion !== null) streamedEmotion = step.emotion
          if (step.delta !== '') {
            if (!textOpen) {
              writer.write({ type: 'text-start', id: TEXT_PART_ID })
              textOpen = true
            }
            writer.write({ type: 'text-delta', id: TEXT_PART_ID, delta: step.delta })
          }
        }

        const output = await result.output
        if (textOpen) {
          writer.write({ type: 'text-end', id: TEXT_PART_ID })
          textOpen = false
        }

        // The validated enum wins over the one seen mid-stream; DEFAULT_EMOTION is the floor.
        const npcEmotion = output.emotion ?? streamedEmotion ?? DEFAULT_EMOTION
        const turn = await args.onReply(
          output.reply.trim(),
          npcEmotion,
          output.learnerEmotion ?? null,
        )

        writer.write({ type: 'data-turn', data: turn, transient: true })
      } catch (error) {
        if (textOpen) writer.write({ type: 'text-end', id: TEXT_PART_ID })

        const classified = classifyModelError(captured ?? error)
        // A learner who navigated away is not a failure to report to anyone.
        if (classified.kind === 'cancelled') return

        console.error(`[dialogue] ${classified.kind}: ${classified.log}`)

        writer.write({
          type: 'data-error',
          data: { kind: classified.kind, retryable: classified.retryable },
          transient: true,
        })
      }
    },
    // Backstop only. Its return type is a bare string, so the classified kind travels as the
    // data-error part above rather than through here.
    onError: () => 'dialogue_failed',
  })
}
