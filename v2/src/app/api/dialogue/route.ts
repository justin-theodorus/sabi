import { createUIMessageStreamResponse } from 'ai'
import { z } from 'zod'

import { dialogueModel, MODEL_TIMEOUT_MS } from '@/lib/ai/model'
import type { TurnData } from '@/lib/dialogue/stream-types'
import { createTurnStream } from '@/lib/dialogue/turn-stream'
import { SILENCE_PLACEHOLDER, toModelMessages } from '@/lib/dialogue/history'
import { summarizeExpression } from '@/lib/expression/aggregate'
import { expressionWindowSchema } from '@/lib/expression/schema'
import { parseBody, requireSession } from '@/lib/http'
import { buildSystemPrompt, isSessionComplete } from '@/lib/prompt/build-system-prompt'
import { activeEventFor, availableIconLabels, SCENARIOS } from '@/lib/scenario/hawker-centre'
import { commitTurn, loadHistory } from '@/lib/session/repository'
import type { LearnerExpressionRecord } from '@/lib/session/types'
import { translateIcons } from '@/lib/translate'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ICONS = 12
const MAX_OUTPUT_TOKENS = 256 // main.py:556

const bodySchema = z.object({
  icons: z.array(z.string().min(1).max(40)).max(MAX_ICONS).default([]),
  npcInitiated: z.boolean().default(false),
  // Phase 3. Numbers only — see lib/expression/schema.ts for why that matters.
  expression: expressionWindowSchema,
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
  const { icons, npcInitiated, expression } = body.data

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

  // The learner's face, as arithmetic. The descriptor and the explanation are composed here and
  // not by the caller, so the only thing the browser contributes to the system prompt is numbers.
  // Null when the camera is off or no face was seen, in which case emotionPart drops out and the
  // prompt is byte-identical to a session without the feature.
  const observed = expression ? summarizeExpression(expression) : null

  const system = buildSystemPrompt({
    scenarioId: session.scenarioId,
    mode: session.mode,
    persona: session.persona,
    emotion: observed,
    availableIcons: availableIconLabels(scenario),
    turnIndex: session.turnIndex,
    npcInitiated,
    activeEvent: activeEvent?.context ?? null,
  })

  // The trace that makes the loop checkable end to end: read back off the composed prompt, not
  // off the inputs to it, so it cannot claim something the model was never told. v1 logged the
  // same thing at dialogue-engine/main.py:477.
  const expressionLine = system.split('\n\n').find((part) => part.startsWith('OBSERVABLE'))
  if (expressionLine) console.log(`[dialogue] ${expressionLine}`)

  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS)
  const abort = AbortSignal.any([timeout, request.signal])

  const stream = createTurnStream({
    model: dialogueModel(),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    instructions: system,
    messages: [
      ...toModelMessages(history),
      { role: 'user', content: learnerText || SILENCE_PLACEHOLDER },
    ],
    abortSignal: abort,
    onReply: async (reply, npcEmotion, learnerEmotion) => {
      const sessionComplete = isSessionComplete(session.scenarioId, reply, session.turnIndex + 1)

      // Recorded per turn, not per frame. v1 stored a row per second in `emotion_events` and the
      // only thing that ever read them counted them into "neutral 62%, happy 21%"
      // (therapist/sessions/[sessionId]/page.tsx:88-96). The per-turn aggregate is what both
      // consumers of this data actually want, and it fits the jsonb payload with no migration.
      const learnerExpression: LearnerExpressionRecord | null = observed
        ? { ...observed, learnerEmotion, sampleCount: expression?.length ?? 0 }
        : null

      const { turnIndex, seq } = await commitTurn({
        sessionId: session.id,
        iconSelection: npcInitiated
          ? null
          : { icons, translated: learnerText, turnIndex: session.turnIndex, npcInitiated },
        npcResponse: {
          content: reply,
          npcEmotion,
          turnIndex: session.turnIndex,
          npcInitiated,
          learnerExpression,
        },
        hearts: session.hearts,
      })

      return {
        turnIndex,
        hearts: session.hearts,
        npcEmotion,
        sessionComplete,
        learnerText,
        activeEventLine: activeEvent?.npcLine ?? null,
        seq,
      } satisfies TurnData
    },
  })

  return createUIMessageStreamResponse({ stream })
}
