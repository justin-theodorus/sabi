import { NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError, parseBody, requireSession } from '@/lib/http'
import { appendEvent, loseHeart } from '@/lib/session/repository'

export const runtime = 'nodejs'

// Only the events the client is entitled to originate. Everything about a turn is written by
// /api/dialogue from the server side, so `icon_selection` and `npc_response` are not on this list
// and a client cannot forge a transcript.
const CLIENT_EVENT_TYPES = ['heart_lost', 'event_fired'] as const

const bodySchema = z.object({
  type: z.enum(CLIENT_EVENT_TYPES),
  payload: z.record(z.string(), z.unknown()).default({}),
})

/**
 * Appends a client-originated event.
 *
 * The `[id]` in the path must match the session cookie. v1's equivalent endpoint verified a JWT
 * and then never checked session ownership (finding S4, session-service/index.js:618), so any
 * logged-in user could write events into anyone's session. Keeping the id in the path makes the
 * ownership check explicit rather than implicit.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (id !== auth.session.id) return jsonError(403, 'session mismatch')

  const body = await parseBody(request, bodySchema)
  if (!body.ok) return body.response

  const seq = await appendEvent(auth.session.id, body.data.type, body.data.payload)

  // A heart is deducted by the same request that logs the loss, so the log and the row cannot
  // disagree. v1 logged the event from the client and mutated hearts in a React state updater
  // that also fired the whole end-of-session flow (finding 3.3).
  const hearts =
    body.data.type === 'heart_lost' ? await loseHeart(auth.session.id) : auth.session.hearts

  return NextResponse.json({ seq, hearts }, { status: 201 })
}
