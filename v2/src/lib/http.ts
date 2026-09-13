import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import { loadSession } from '@/lib/session/repository'
import { SESSION_COOKIE, type SessionRow } from '@/lib/session/types'

export const jsonError = (status: number, error: string, detail?: unknown) =>
  NextResponse.json(detail === undefined ? { error } : { error, detail }, { status })

/**
 * Parses and validates a JSON body. Every route boundary goes through this, so an unknown mode,
 * persona or scenario id is a 400 rather than a silent fallback to hawker_centre / zippy_sotong
 * the way v1's dict `.get(key, default)` lookups were (main.py:373, :381).
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: jsonError(400, 'body must be valid JSON') }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(400, 'invalid request body', parsed.error.issues),
    }
  }

  return { ok: true, data: parsed.data }
}

/**
 * Resolves the caller's session from the httpOnly cookie.
 *
 * The cookie is the only accepted source. A session id in the request body is ignored, because
 * that is what made v1's session-service endpoints writable by anyone who was merely logged in:
 * they verified a token and then never checked that the caller owned the session
 * (finding S4, session-service/index.js endpoints 12-16 and 18-20).
 */
export async function requireSession(): Promise<
  { ok: true; session: SessionRow } | { ok: false; response: NextResponse }
> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  if (!id) return { ok: false, response: jsonError(401, 'no session') }

  const session = await loadSession(id)
  if (!session) return { ok: false, response: jsonError(404, 'session not found') }
  if (session.status !== 'active') return { ok: false, response: jsonError(409, 'session already ended') }

  return { ok: true, session }
}
