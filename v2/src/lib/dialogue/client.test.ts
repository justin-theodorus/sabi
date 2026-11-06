import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readTurnStream } from '@/lib/dialogue/client'
import { TurnFailure } from '@/lib/dialogue/turn-failure'
import type { TurnData } from '@/lib/dialogue/stream-types'

/** Frames chunks the way the AI SDK's UI message stream does, so this drives the real parser. */
function sseStream(chunks: readonly unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }
      controller.close()
    },
  })
}

function collector() {
  const deltas: string[] = []
  let metadata: TurnData | null = null
  return {
    deltas,
    get metadata() {
      return metadata
    },
    callbacks: {
      onStart: () => {},
      onDelta: (text: string) => deltas.push(text),
      onMetadata: (data: TurnData) => {
        metadata = data
      },
    },
  }
}

const TURN: TurnData = {
  turnIndex: 1,
  hearts: 5,
  npcEmotion: 'happy',
  completion: null,
  learnerText: 'I want chicken rice',
  activeEventLine: null,
  seq: 2,
} as TurnData

test('a normal turn yields its deltas in order and then its metadata', async () => {
  const c = collector()
  await readTurnStream(
    sseStream([
      { type: 'text-start', id: 'npc-reply' },
      { type: 'text-delta', id: 'npc-reply', delta: 'Chicken rice' },
      { type: 'text-delta', id: 'npc-reply', delta: ', okay!' },
      { type: 'text-end', id: 'npc-reply' },
      { type: 'data-turn', data: TURN, transient: true },
    ]),
    c.callbacks,
  )

  assert.deepEqual(c.deltas, ['Chicken rice', ', okay!'])
  assert.equal(c.metadata?.seq, 2)
  assert.equal(c.metadata?.npcEmotion, 'happy')
})

test('a classified server error rejects with its kind, not silently', async () => {
  // This is finding 3.1 as a test. v1 threw inside a try whose `catch {}` swallowed it, so the
  // rate-limit path was dead on arrival and the learner saw a stream that just stopped.
  const c = collector()
  await assert.rejects(
    readTurnStream(
      sseStream([
        { type: 'data-error', data: { kind: 'rate_limited', retryable: true }, transient: true },
      ]),
      c.callbacks,
    ),
    (error: unknown) => error instanceof TurnFailure && error.kind === 'rate_limited',
  )
})

test('the classified kind survives an error chunk arriving after it', async () => {
  const c = collector()
  await assert.rejects(
    readTurnStream(
      sseStream([
        { type: 'data-error', data: { kind: 'provider_overloaded', retryable: true } },
        { type: 'error', errorText: 'dialogue_failed' },
      ]),
      c.callbacks,
    ),
    (error: unknown) => error instanceof TurnFailure && error.kind === 'provider_overloaded',
  )
})

test('an unclassified error chunk still fails loudly', async () => {
  const c = collector()
  await assert.rejects(
    readTurnStream(sseStream([{ type: 'error', errorText: 'boom' }]), c.callbacks),
    (error: unknown) => error instanceof TurnFailure && error.kind === 'stream_failed',
  )
})

test('deltas delivered before a failure are still reported', async () => {
  const c = collector()
  await assert.rejects(
    readTurnStream(
      sseStream([
        { type: 'text-delta', id: 'npc-reply', delta: 'Chicken' },
        { type: 'data-error', data: { kind: 'timeout', retryable: true } },
      ]),
      c.callbacks,
    ),
    TurnFailure,
  )
  assert.deepEqual(c.deltas, ['Chicken'])
})

test('a stream that ends cleanly with no turn data does not invent one', async () => {
  const c = collector()
  await readTurnStream(sseStream([{ type: 'text-start', id: 'npc-reply' }]), c.callbacks)
  assert.equal(c.metadata, null)
  assert.deepEqual(c.deltas, [])
})

test('unknown chunk types are ignored rather than throwing', async () => {
  const c = collector()
  await readTurnStream(
    sseStream([
      { type: 'start' },
      { type: 'text-delta', id: 'npc-reply', delta: 'hi' },
      { type: 'finish' },
    ]),
    c.callbacks,
  )
  assert.deepEqual(c.deltas, ['hi'])
})
