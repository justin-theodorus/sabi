import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LEARNER_EMOTIONS } from '@/lib/expression/types'
import {
  advancePartialReply,
  INITIAL_PARTIAL_STATE,
  isNpcEmotion,
  npcReplySchema,
  type PartialReplyState,
} from '@/lib/dialogue/npc-reply'

test('the schema declares every metadata field before reply, so they survive truncation', () => {
  // Field order is the emission order. `emotion` first flips the sprite as the NPC starts
  // speaking; `learnerEmotion` and `farewell` next are the records that a reply truncated at 256
  // tokens would otherwise lose. The prose is last because it is the only field that can be long.
  assert.deepEqual(Object.keys(npcReplySchema.shape), [
    'emotion',
    'learnerEmotion',
    'farewell',
    'reply',
  ])
})

test('the farewell flag is required, unlike the learner emotion', () => {
  // The asymmetry is deliberate. An absent learnerEmotion costs a data point; an absent farewell
  // would read as "keep talking" and is the stranding finding S11 describes, so it must be stated.
  assert.equal(npcReplySchema.safeParse({ emotion: 'happy', reply: 'Come again!' }).success, false)
  assert.equal(
    npcReplySchema.safeParse({ emotion: 'happy', farewell: true, reply: 'Come again!' }).success,
    true,
  )
})

test('an omitted learner emotion is accepted, because it must not fail the turn', () => {
  assert.equal(npcReplySchema.safeParse({ emotion: 'happy', farewell: false, reply: 'hi' }).success, true)
  assert.equal(
    npcReplySchema.safeParse({ emotion: 'happy', learnerEmotion: null, farewell: false, reply: 'hi' })
      .success,
    true,
  )
})

test('the schema accepts every label in the learner vocabulary and rejects the rest', () => {
  for (const learnerEmotion of LEARNER_EMOTIONS) {
    const result = npcReplySchema.safeParse({
      emotion: 'happy',
      learnerEmotion,
      farewell: false,
      reply: 'hi',
    })
    assert.equal(result.success, true, learnerEmotion)
  }
  // v1 interpolated whatever string the model returned straight into the next system prompt
  // (dialogue-engine/main.py:860 into :413), with no enum anywhere on the path.
  const rejected = npcReplySchema.safeParse({
    emotion: 'happy',
    learnerEmotion: 'exasperated',
    farewell: false,
    reply: 'hi',
  })
  assert.equal(rejected.success, false)
})

test('the schema rejects an emotion with no sprite', () => {
  const result = npcReplySchema.safeParse({ emotion: 'ecstatic', farewell: false, reply: 'hi' })
  assert.equal(result.success, false)
})

test('the schema accepts all six sprite emotions', () => {
  for (const emotion of ['happy', 'sad', 'mad', 'confused', 'surprised', 'neutral']) {
    const parsed = npcReplySchema.safeParse({ emotion, farewell: false, reply: 'hi' })
    assert.equal(parsed.success, true, emotion)
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
