import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai'
import { z } from 'zod'

import { dialogueModel, MODEL_TIMEOUT_MS } from '@/lib/ai/model'
import { detectNpcEmotion } from '@/lib/dialogue/detect-npc-emotion'
import type { SabiUIMessage, TurnData } from '@/lib/dialogue/stream-types'
import { SILENCE_PLACEHOLDER, toModelMessages } from '@/lib/dialogue/history'
import { parseBody, requireSession } from '@/lib/http'
import { buildSystemPrompt, isSessionComplete } from '@/lib/prompt/build-system-prompt'
import { activeEventFor, availableIconLabels, SCENARIOS } from '@/lib/scenario/hawker-centre'
import { commitTurn, loadHistory } from '@/lib/session/repository'
import { translateIcons } from '@/lib/translate'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ICONS = 12
const MAX_OUTPUT_TOKENS = 256 // main.py:556

const bodySchema = z.object({
  icons: z.array(z.string().min(1).max(40)).max(MAX_ICONS).default([]),
  npcInitiated: z.boolean().default(false),
})

/**
 * One streamed NPC turn.
 *
 * Streaming is the AI SDK's UI message stream, consumed on the client by the SDK's own
 * parseJsonEventStream + readUIMessageStream. That is the entirety of the fix for finding 3.1:
 * v1 hand-rolled an SSE parser whose `throw new Error(...)` on an error event was caught by the
 * empty `catch {}` one line below it (lib/dialogue.ts:141-142), so the backend's rate-limit path
 * was dead on arrival — the learner saw the stream end silently and an empty assistant message
 * got appended to history, corrupting every later turn. There is no parser here to get wrong,
 * and a stream error rejects the client's iterator.
 */
export async function POST(request: Request) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response
  const { icons, npcInitiated } = body.data

  if (icons.length === 0 && !npcInitiated) {
    return Response.json({ error: 'icons must be a non-empty array' }, { status: 400 })
  }

  const scenario = SCENARIOS[session.scenarioId]

  // Direct call, not an HTTP hop to /api/translate. v1 ran this as its own container and the
  // network round trip blocked every turn; the finding was the hop, not the function.
  const learnerText = npcInitiated ? '' : translateIcons(icons)

  const history = await loadHistory(session.id)
  const activeEvent = activeEventFor(
    scenario,
    session.eventId,
    session.eventTriggerTurn,
    session.turnIndex,
  )

  const system = buildSystemPrompt({
    scenarioId: session.scenarioId,
    mode: session.mode,
    persona: session.persona,
    availableIcons: availableIconLabels(scenario),
    turnIndex: session.turnIndex,
    npcInitiated,
    activeEvent: activeEvent?.context ?? null,
  })

  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS)
  const abort = AbortSignal.any([timeout, request.signal])

  const stream = createUIMessageStream<SabiUIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: dialogueModel(),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        instructions: system,
        messages: [
          ...toModelMessages(history),
          { role: 'user', content: learnerText || SILENCE_PLACEHOLDER },
        ],
        abortSignal: abort,
      })

      writer.merge(toUIMessageStream({ stream: result.stream }))

      // Awaited after the merge, so tokens are already flowing to the client while this settles.
      const reply = (await result.text).trim()
      const npcEmotion = detectNpcEmotion(reply)
      const sessionComplete = isSessionComplete(session.scenarioId, reply, session.turnIndex + 1)

      const { turnIndex, seq } = await commitTurn({
        sessionId: session.id,
        iconSelection: npcInitiated
          ? null
          : { icons, translated: learnerText, turnIndex: session.turnIndex, npcInitiated },
        npcResponse: { content: reply, npcEmotion, turnIndex: session.turnIndex, npcInitiated },
        hearts: session.hearts,
        status: sessionComplete ? 'completed' : 'active',
        endReason: sessionComplete ? 'farewell' : null,
      })

      writer.write({
        type: 'data-turn',
        data: {
          turnIndex,
          hearts: session.hearts,
          npcEmotion,
          sessionComplete,
          learnerText,
          activeEventLine: activeEvent?.npcLine ?? null,
          seq,
        } satisfies TurnData,
        transient: true,
      })
    },
    // Errors are masked by default. These are our own strings, not provider internals, and the
    // learner needs to know the turn failed rather than watch it end silently.
    onError: (error) => (error instanceof Error ? error.message : 'dialogue_failed'),
  })

  return createUIMessageStreamResponse({ stream })
}
