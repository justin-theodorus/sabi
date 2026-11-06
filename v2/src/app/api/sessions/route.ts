import { randomUUID } from 'node:crypto'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { MODE_IDS, PERSONA_IDS, SCENARIO_IDS } from '@/lib/prompt/types'
import { parseBody } from '@/lib/http'
import { DEFAULT_PERSONA } from '@/lib/persona/classify'
import { rollScenarioEvent, SCENARIOS } from '@/lib/scenario/hawker-centre'
import { createSession } from '@/lib/session/repository'
import { SESSION_COOKIE } from '@/lib/session/types'

export const runtime = 'nodejs'

const SESSION_TTL_SECONDS = 60 * 60 * 24

const bodySchema = z.object({
  mode: z.enum(MODE_IDS),
  persona: z.enum(PERSONA_IDS).default(DEFAULT_PERSONA),
  scenarioId: z.enum(SCENARIO_IDS).default('hawker_centre'),
})

/**
 * Creates an anonymous session. There is no auth and no account.
 *
 * Removing the auth surface is the security fix for findings S1-S4, not merely a demo
 * convenience: v1 read the caller's role from `user_metadata`, which the user controls, and four
 * services were reachable through the gateway with no authentication at all. Patching eight
 * copy-pasted role checks would have left the model wrong at the root.
 *
 * The session id is therefore the only capability, so it must be unguessable. crypto.randomUUID
 * is CSPRNG-backed with 122 bits of randomness, generated here rather than by the database
 * because the cookie has to be set on this response. v1's session-service made the same argument
 * at index.js:789 and failed to hold it, because there the UUID was also embedded in
 * client-readable Supabase rows. Here it lives in an httpOnly cookie and is never served back
 * into a page.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response

  const { mode, persona, scenarioId } = body.data
  const scenario = SCENARIOS[scenarioId]
  const { eventId, eventTriggerTurn } = rollScenarioEvent(scenario)

  const session = await createSession({
    id: randomUUID(),
    scenarioId,
    mode,
    persona,
    eventId,
    eventTriggerTurn,
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })

  return NextResponse.json(
    {
      sessionId: session.id,
      scenarioId: session.scenarioId,
      mode: session.mode,
      persona: session.persona,
      hearts: session.hearts,
      turnIndex: session.turnIndex,
      greeting: scenario.npcGreeting,
      startedAt: session.startedAt.toISOString(),
    },
    { status: 201 },
  )
}
