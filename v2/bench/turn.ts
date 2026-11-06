// One session, driven over HTTP against a deployed build.
//
// The stream is read by readTurnStream from src/lib/dialogue/client.ts — the SAME parser the
// browser uses — rather than by a second implementation here. That is deliberate: a bench with
// its own parser is a bench that can disagree with the product about what happened, which is how
// v1's load test ended up timing a translate call whose output it silently threw away.

import { readTurnStream } from '@/lib/dialogue/client'
import type { TurnData } from '@/lib/dialogue/stream-types'
import {
  assertEqual,
  assertHeaderMatches,
  assertNonEmptyString,
  assertNumber,
  assertPresent,
  assertStatus,
} from './assert'
import type { SessionSample, TurnSample } from './types'

/** The learner's utterances, cycled. Real board labels, so translateIcons does real work. */
const UTTERANCES: readonly (readonly string[])[] = [
  ['I', 'want', 'chicken rice'],
  ['no', 'spicy'],
  ['I', 'want', 'drink'],
  ['how much'],
  ['thank', 'you'],
  ['yes', 'please'],
]

interface Cookie {
  readonly header: string
}

async function createSession(base: string): Promise<{ sessionId: string; cookie: Cookie; ms: number }> {
  const startedAt = performance.now()
  const response = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'learning', persona: 'steady_turtle' }),
  })
  const ms = performance.now() - startedAt

  // This assertion is also the stale-deploy detector. A build without Phase 1's API answers 404
  // here, and the run dies on its first request instead of reporting zero samples.
  assertStatus(response, 201, 'POST /api/sessions')

  const setCookie = response.headers.getSetCookie()
  const session = setCookie.find((c) => c.startsWith('sabi_session='))
  assertPresent(session, 'POST /api/sessions did not set a sabi_session cookie')

  const body = (await response.json()) as Record<string, unknown>
  const sessionId = assertNonEmptyString(body.sessionId, 'sessions.sessionId')
  assertNonEmptyString(body.greeting, 'sessions.greeting')
  assertEqual(body.hearts, 5, 'sessions.hearts')

  return { sessionId, cookie: { header: session!.split(';')[0] }, ms }
}

async function runTurn(
  base: string,
  cookie: Cookie,
  icons: readonly string[],
  ordinals: { sessionOrdinal: number; turnOrdinal: number; globalOrdinal: number },
): Promise<TurnSample> {
  const startedAt = performance.now()

  const response = await fetch(`${base}/api/dialogue`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie.header },
    body: JSON.stringify({ icons, npcInitiated: false, expression: null, frameInference: null }),
  })
  const headersMs = performance.now() - startedAt

  assertStatus(response, 200, 'POST /api/dialogue')
  assertHeaderMatches(response, 'content-type', /^text\/event-stream/, 'dialogue content-type')
  const body = assertPresent(response.body, 'dialogue response had no body')

  let ttftMs: number | null = null
  let ttctMs: number | null = null
  let turn: TurnData | null = null
  let text = ''

  await readTurnStream(body, {
    onStart: () => {},
    onDelta: (delta) => {
      ttftMs ??= performance.now() - startedAt
      text += delta
    },
    onMetadata: (data) => {
      ttctMs = performance.now() - startedAt
      turn = data
    },
  })
  const streamCloseMs = performance.now() - startedAt

  // Every one of these throws. None falls back. See bench/assert.ts for why that is the point.
  // Explicit type arguments: these are only ever assigned inside the stream callbacks, so
  // control-flow analysis still believes them to be null at this point.
  const visibleMs = assertPresent<number | null>(
    ttftMs,
    'the turn produced no text-delta, so there is no visible TTFT to record',
  )
  const completeMs = assertPresent<number | null>(ttctMs, 'the turn produced no data-turn timestamp')
  const committed = assertPresent<TurnData | null>(
    turn,
    'the turn produced no data-turn, so nothing was committed',
  )
  assertNonEmptyString(text.trim(), 'npc reply text')

  return {
    ...ordinals,
    headersMs,
    ttftMs: visibleMs,
    ttctMs: completeMs,
    streamCloseMs,
    replyChars: text.length,
    turnIndex: assertNumber(committed.turnIndex, 'data-turn.turnIndex'),
    seq: assertNumber(committed.seq, 'data-turn.seq'),
    vercelId: response.headers.get('x-vercel-id'),
  }
}

async function endSession(base: string, cookie: Cookie, sessionId: string): Promise<number> {
  const startedAt = performance.now()
  const response = await fetch(`${base}/api/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie.header },
    body: JSON.stringify({ reason: 'manual' }),
  })
  assertStatus(response, 200, 'POST /api/sessions/:id/end')
  return performance.now() - startedAt
}

/**
 * Drives one session to completion. Turns are serial within a session by necessity, not by
 * preference: two concurrent dialogue POSTs on one session collide on `unique (session_id, seq)`
 * by design (repository.ts:84-89), so running them in parallel would measure that constraint
 * rather than any throughput.
 */
export async function runSession(
  base: string,
  sessionOrdinal: number,
  turnsPerSession: number,
  nextGlobalOrdinal: () => number,
): Promise<SessionSample> {
  const turns: TurnSample[] = []
  let sessionId = ''

  try {
    const created = await createSession(base)
    sessionId = created.sessionId

    for (let turnOrdinal = 0; turnOrdinal < turnsPerSession; turnOrdinal += 1) {
      turns.push(
        await runTurn(base, created.cookie, UTTERANCES[turnOrdinal % UTTERANCES.length], {
          sessionOrdinal,
          turnOrdinal,
          globalOrdinal: nextGlobalOrdinal(),
        }),
      )
    }

    const endMs = await endSession(base, created.cookie, sessionId)
    return { sessionOrdinal, sessionId, createMs: created.ms, endMs, turns, error: null }
  } catch (error) {
    return {
      sessionOrdinal,
      sessionId,
      createMs: 0,
      endMs: 0,
      turns,
      error: (error as Error).message,
    }
  }
}
