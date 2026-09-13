import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  advancePartialReply,
  INITIAL_PARTIAL_STATE,
  isNpcEmotion,
  npcReplySchema,
  type PartialReplyState,
} from '@/lib/dialogue/npc-reply'

test('the schema declares emotion before reply, so it streams first', () => {
  assert.deepEqual(Object.keys(npcReplySchema.shape), ['emotion', 'reply'])
})

test('the schema rejects an emotion with no sprite', () => {
  const result = npcReplySchema.safeParse({ emotion: 'ecstatic', reply: 'hi' })
  assert.equal(result.success, false)
})

test('the schema accepts all six sprite emotions', () => {
  for (const emotion of ['happy', 'sad', 'mad', 'confused', 'surprised', 'neutral']) {
    assert.equal(npcReplySchema.safeParse({ emotion, reply: 'hi' }).success, true, emotion)
  }
})

test('isNpcEmotion rejects a partial enum token', () => {
  // Observed live: partialOutputStream yields {emotion: 'ha'} one chunk before {emotion: 'happy'}.
  assert.equal(isNpcEmotion('ha'), false)
  assert.equal(isNpcEmotion('happy'), true)
  assert.equal(isNpcEmotion(undefined), false)
  assert.equal(isNpcEmotion(42), false)
})

test('a partial carrying only a half-streamed emotion emits nothing', () => {
  const step = advancePartialReply(INITIAL_PARTIAL_STATE, { emotion: 'ha' })
  assert.equal(step.delta, '')
  assert.equal(step.emotion, null)
  assert.equal(step.state.emotion, null)
})

test('the emotion is emitted exactly once, on the step that resolves it', () => {
  const first = advancePartialReply(INITIAL_PARTIAL_STATE, { emotion: 'happy', reply: 'Wah' })
  assert.equal(first.emotion, 'happy')

  const second = advancePartialReply(first.state, { emotion: 'happy', reply: 'Wah, you want' })
  assert.equal(second.emotion, null, 'already sent')
  assert.equal(second.state.emotion, 'happy')
})

test('each partial yields only the text not already sent', () => {
  const deltas: string[] = []
  let state: PartialReplyState = INITIAL_PARTIAL_STATE

  for (const reply of ['Wah, ', 'Wah, you want ', 'Wah, you want chicken rice?']) {
    const step = advancePartialReply(state, { emotion: 'happy', reply })
    deltas.push(step.delta)
    state = step.state
  }

  assert.deepEqual(deltas, ['Wah, ', 'you want ', 'chicken rice?'])
  assert.equal(deltas.join(''), 'Wah, you want chicken rice?')
})

test('a repeated partial emits no duplicate text', () => {
  const first = advancePartialReply(INITIAL_PARTIAL_STATE, { emotion: 'sad', reply: 'Aiyo' })
  const again = advancePartialReply(first.state, { emotion: 'sad', reply: 'Aiyo' })
  assert.equal(again.delta, '')
  assert.equal(again.state.sentChars, 4)
})

test('a missing reply field is treated as no prose yet', () => {
  const step = advancePartialReply(INITIAL_PARTIAL_STATE, { emotion: 'mad' })
  assert.equal(step.delta, '')
  assert.equal(step.emotion, 'mad')
})

test('the accumulated deltas reconstruct the reply exactly', () => {
  const chunks = ['A', 'Ah', 'Ah!', 'Ah! You', 'Ah! You want kopi?']
  let state = INITIAL_PARTIAL_STATE
  let rebuilt = ''

  for (const reply of chunks) {
    const step = advancePartialReply(state, { emotion: 'surprised', reply })
    rebuilt += step.delta
    state = step.state
  }

  assert.equal(rebuilt, 'Ah! You want kopi?')
})
