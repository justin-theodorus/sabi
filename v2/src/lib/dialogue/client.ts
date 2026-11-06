import { parseJsonEventStream, uiMessageChunkSchema } from 'ai'

import type { TurnData, TurnErrorData } from '@/lib/dialogue/stream-types'
import type { ExpressionSample, FrameInferenceStats } from '@/lib/expression/types'
import { TurnFailure } from '@/lib/dialogue/turn-failure'

/**
 * Reads a turn from POST /api/dialogue.
 *
 * The SSE framing is parsed by the AI SDK's own `parseJsonEventStream` against its own
 * `uiMessageChunkSchema` — the exact path the SDK's HttpChatTransport uses internally. There is
 * no parser of ours to get wrong.
 *
 * That is the whole of the fix for finding 3.1. v1 hand-rolled the parser in
 * frontend/src/lib/dialogue.ts:119-146, where `throw new Error(data.error)` on an error event sat
 * inside the same try block as the empty `catch {}` one line below, so the backend's rate-limit
 * path was dead on arrival: the stream just ended, `replyText` stayed '', and an empty assistant
 * message was appended to history, poisoning every later turn. The same empty catch also
 * swallowed JSON parse failures and anything the callbacks themselves threw.
 *
 * Here an error chunk rejects, and so does a malformed chunk. Callers get a failure they must
 * handle.
 */
export interface DialogueCallbacks {
  readonly onStart: () => void
  readonly onDelta: (text: string) => void
  readonly onMetadata: (data: TurnData) => void
}

export async function streamDialogue(
  body: {
    icons: readonly string[]
    npcInitiated: boolean
    /** Ten numbers per second of composing. Never a frame, never a string. */
    expression: readonly ExpressionSample[] | null
    /** Phase 5. How long the landmarker took per frame on THIS device. Logged, never prompted. */
    frameInference: FrameInferenceStats | null
  },
  callbacks: DialogueCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/dialogue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new Error(`dialogue request failed (${response.status}) ${detail}`.trim())
  }

  callbacks.onStart()

  return readTurnStream(response.body, callbacks)
}

/**
 * Reads an already-open turn stream. Split out of `streamDialogue` in Phase 5 so the bench
 * harness reads the wire with the SAME parser the browser does, rather than a second
 * implementation that could drift from it — which is exactly how v1 ended up with a load test
 * that read a `translation` key the service had never emitted (locustfile.py:276).
 *
 * `streamDialogue` owns the fetch because its URL is relative and only valid in a browser; this
 * half is transport-agnostic and runs anywhere there is a ReadableStream.
 */
export async function readTurnStream(
  body: ReadableStream<Uint8Array>,
  callbacks: DialogueCallbacks,
): Promise<void> {
  const chunks = parseJsonEventStream({ stream: body, schema: uiMessageChunkSchema })
  const reader = chunks.getReader()
  let failure: TurnFailure['kind'] | null = null

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        if (failure !== null) throw new TurnFailure(failure)
        break
      }
      if (!value.success) throw value.error

      const chunk = value.value
      switch (chunk.type) {
        case 'text-delta':
          callbacks.onDelta(chunk.delta)
          break
        case 'data-turn':
          callbacks.onMetadata(chunk.data as TurnData)
          break
        case 'data-error':
          // The server classified this one. Remember it and let the stream close; the `error`
          // chunk that follows carries only an opaque string.
          failure = (chunk.data as TurnErrorData).kind
          break
        case 'error':
          throw new TurnFailure(failure ?? 'stream_failed')
        default:
          break
      }
    }
  } finally {
    // v1 never released its reader and offered callers no way to abort at all, so a stream kept
    // writing into a torn-down page after "back to lobby".
    reader.releaseLock()
    await chunks.cancel().catch(() => {})
  }
}
