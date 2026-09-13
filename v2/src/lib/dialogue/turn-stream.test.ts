import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { TurnData } from '@/lib/dialogue/stream-types'
import { createTurnStream, type TurnStreamArgs } from '@/lib/dialogue/turn-stream'
import type { NpcEmotion } from '@/lib/prompt/types'
import { apiCallError, failingModel, streamingModel } from '@/test/model-mock'

const TURN: TurnData = {
  turnIndex: 1,
  hearts: 5,
  npcEmotion: 'neutral',
  sessionComplete: false,
  learnerText: 'I want rice',
  activeEventLine: null,
  seq: 2,
}

interface Collected {
  readonly chunks: readonly Record<string, unknown>[]
  readonly text: string
  readonly seen: { reply: string; emotion: NpcEmotion } | null
}

async function collect(overrides: Partial<TurnStreamArgs>): Promise<Collected> {
  let seen: { reply: string; emotion: NpcEmotion } | null = null

  const stream = createTurnStream({
    model: streamingModel(['{"emotion":"happy","reply":"Hi"}']),
    instructions: 'be a hawker uncle',
    messages: [{ role: 'user', content: 'rice' }],
    maxOutputTokens: 256,
    onReply: async (reply, emotion) => {
      seen = { reply, emotion }
      return { ...TURN, npcEmotion: emotion }
    },
    ...overrides,
  })

  const chunks: Record<string, unknown>[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Record<string, unknown>>) {
    chunks.push(chunk)
  }

  const text = chunks
    .filter((c) => c.type === 'text-delta')
    .map((c) => c.delta as string)
    .join('')

  return { chunks, text, seen }
}

const typesOf = (c: Collected) => c.chunks.map((chunk) => chunk.type)
const dataOf = (c: Collected, type: string) =>
  c.chunks.find((chunk) => chunk.type === type)?.data as Record<string, unknown> | undefined

test('the reply streams as text deltas and the JSON envelope never reaches the client', async () => {
  const collected = await collect({
    model: streamingModel(['{"emotion":"ha', 'ppy","reply":"Wah, ', 'you want rice?"}']),
  })

  assert.equal(collected.text, 'Wah, you want rice?')
  assert.ok(!collected.text.includes('{'), 'no raw JSON leaked')
  assert.ok(!collected.text.includes('emotion'), 'no field name leaked')
})

test('text parts are opened and closed around the deltas', async () => {
  const types = typesOf(await collect({}))
  assert.ok(types.indexOf('text-start') < types.indexOf('text-delta'))
  assert.ok(types.indexOf('text-delta') < types.indexOf('text-end'))
  assert.equal(types.filter((t) => t === 'text-start').length, 1)
})

test('the persisted reply is the trimmed prose, not the JSON', async () => {
  const collected = await collect({
    model: streamingModel(['{"emotion":"sad","reply":"  Aiyo, sold out.  "}']),
  })
  assert.equal(collected.seen?.reply, 'Aiyo, sold out.')
})

test('an invalid key is reported as provider_rejected, not as "no output generated"', async () => {
  const collected = await collect({ model: failingModel(apiCallError(401)) })

  assert.equal(dataOf(collected, 'data-error')?.kind, 'provider_rejected')
  assert.equal(dataOf(collected, 'data-error')?.retryable, false)
  assert.equal(dataOf(collected, 'data-turn'), undefined, 'no turn is committed')
})

test('a rate limit is distinguished from an overload and both are retryable', async () => {
  const limited = await collect({ model: failingModel(apiCallError(429, true)) })
  assert.equal(dataOf(limited, 'data-error')?.kind, 'rate_limited')
  assert.equal(dataOf(limited, 'data-error')?.retryable, true)

  const overloaded = await collect({ model: failingModel(apiCallError(529, true)) })
  assert.equal(dataOf(overloaded, 'data-error')?.kind, 'provider_overloaded')
  assert.equal(dataOf(overloaded, 'data-error')?.retryable, true)
})

test('a transport failure is reported as network', async () => {
  const collected = await collect({ model: failingModel(new TypeError('fetch failed')) })
  assert.equal(dataOf(collected, 'data-error')?.kind, 'network')
})

test('output that does not satisfy the schema never commits a turn', async () => {
  // The model answered, but with an emotion that has no sprite. v1 would have interpolated it
  // straight into an <img src> (ScenarioStage.tsx:50-51) and 404'd.
  const collected = await collect({
    model: streamingModel(['{"emotion":"ecstatic","reply":"Hello!"}']),
  })

  assert.equal(dataOf(collected, 'data-error')?.kind, 'malformed_output')
  assert.equal(dataOf(collected, 'data-turn'), undefined)
  assert.equal(collected.seen, null, 'nothing was persisted')
})

test('a failure never emits a data-turn, so no partial turn is logged', async () => {
  for (const status of [401, 429, 500, 529]) {
    const collected = await collect({ model: failingModel(apiCallError(status)) })
    assert.equal(dataOf(collected, 'data-turn'), undefined, `status ${status}`)
  }
})
