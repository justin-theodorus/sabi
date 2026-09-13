import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { classifyModelError } from '@/lib/ai/errors'
import { dialogueModel, MODEL_TIMEOUT_MS } from '@/lib/ai/model'
import { parseBody, requireSession } from '@/lib/http'
import { SCENARIO_DESCRIPTIONS } from '@/lib/prompt/constants'
import { loadHistory } from '@/lib/session/repository'

export const runtime = 'nodejs'

const MAX_OUTPUT_TOKENS = 5 // main.py:727

const bodySchema = z.object({
  learnerText: z.string().min(1).max(500),
})

/**
 * Is the learner's reply off-topic for what the NPC just said? Survival mode only; a `true`
 * costs a heart.
 *
 * Ported from v1 /judge (main.py:711-733). Two deliberate differences:
 *
 * 1. The NPC's last line is read from the event log, not taken from the request body. v1 let the
 *    client supply both sides of the comparison (session/page.tsx:547-548), so the input to a
 *    heart-losing decision was client-controlled.
 *
 * 2. Failing open is now the argued default rather than an accident. v1 got there via
 *    `catch { return false }` in the client (lib/dialogue.ts:163), which happens to be the right
 *    direction but was never stated anywhere (finding S12). A model outage should not cost a
 *    child a heart, so an error here means "not off-context".
 */
export async function POST(request: Request) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response

  if (session.mode !== 'survival') {
    return NextResponse.json({ offContext: false, reason: 'not_survival_mode' })
  }

  const history = await loadHistory(session.id)
  const lastNpcLine = history.findLast((event) => event.type === 'npc_response')?.payload.content
  if (typeof lastNpcLine !== 'string' || lastNpcLine.length === 0) {
    // Nothing to be off-context from yet.
    return NextResponse.json({ offContext: false, reason: 'no_npc_turn_yet' })
  }

  const prompt =
    `Scenario: ${SCENARIO_DESCRIPTIONS[session.scenarioId]}\n` +
    `The other person said: "${lastNpcLine}"\n` +
    `The learner replied: "${body.data.learnerText}"\n\n` +
    'Is the learner\'s reply off-topic or irrelevant to what the other person said? ' +
    'Answer with exactly one word: yes or no.'

  try {
    const { text } = await generateText({
      model: dialogueModel(),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      prompt,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    })

    // v1 compared `answer == "yes"` exactly (main.py:731), so "Yes." with a period read as
    // not-off-context. Normalising costs one line.
    const answer = text.trim().toLowerCase().replace(/[^a-z]/g, '')
    return NextResponse.json({ offContext: answer === 'yes' })
  } catch (error) {
    // Still fails open, but the operator now learns which failure it was rather than reading one
    // undifferentiated message for a rate limit, a bad key and a timeout alike (finding S5).
    const classified = classifyModelError(error)
    console.error(`[judge] failing open on ${classified.kind}: ${classified.log}`)
    return NextResponse.json({ offContext: false, reason: `judge_unavailable:${classified.kind}` })
  }
}
