// Finding 2.9, after the fix.
//
// These are the five cases that `detect-npc-emotion.test.ts` pinned to the WRONG answer while the
// keyword classifier was still in the runtime path. The classifier is gone; the emotion now comes
// from the model as a schema-enforced enum in the dialogue call that was already happening
// (npc-reply.ts). Same inputs, corrected expectations, so the before/after stays legible.
//
// v1's branch order was sad -> confused -> mad -> surprised -> happy, and `confused` matched the
// bare substring "?" (dialogue-engine/main.py:493-495). The NPC is told to "Ask only ONE thing at
// a time" (main.py:463), so nine of ten replies in the Phase 1 end-to-end run came back confused,
// the sprite froze on confused.png, and `is_repair` was near-constant-true in a therapist-facing
// log.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { TurnData } from '@/lib/dialogue/stream-types'
import { createTurnStream } from '@/lib/dialogue/turn-stream'
import { NPC_EMOTIONS, type NpcEmotion } from '@/lib/prompt/types'
import { streamingModel } from '@/test/model-mock'

const TURN: TurnData = {
  turnIndex: 1,
  hearts: 5,
  npcEmotion: 'neutral',
  completion: null,
  learnerText: '',
  activeEventLine: null,
  seq: 1,
}

/** Runs one turn with a model that answers with the given emotion and line. */
async function emotionFor(emotion: NpcEmotion, reply: string): Promise<string | undefined> {
  const stream = createTurnStream({
    model: streamingModel([JSON.stringify({ emotion, farewell: false, reply })]),
    instructions: 'hawker uncle',
    messages: [{ role: 'user', content: 'hi' }],
    maxOutputTokens: 256,
    onReply: async (_reply, npcEmotion) => ({ ...TURN, npcEmotion }),
  })

  for await (const chunk of stream as unknown as AsyncIterable<Record<string, unknown>>) {
    if (chunk.type === 'data-turn') {
      return (chunk.data as TurnData).npcEmotion
    }
  }
  return undefined
}

test('2.9: a question mark no longer short-circuits a happy reply to confused', async () => {
  // Was: detectNpcEmotion('Thanks ah, what else you want?') === 'confused'.
  assert.equal(await emotionFor('happy', 'Thanks ah, what else you want?'), 'happy')
})

test('2.9: anger is reachable even when the line also ends in a question mark', async () => {
  // Was: detectNpcEmotion('Oi! Are you serious?') === 'confused', because "?" beat "!".
  assert.equal(await emotionFor('mad', 'Oi! Are you serious?'), 'mad')
})

test('2.9: an NPC asking one question per turn is no longer confused every turn', async () => {
  // Was: all four came back 'confused'. The model is free to answer differently for each.
  const turns: readonly (readonly [NpcEmotion, string])[] = [
    ['neutral', 'What you want?'],
    ['happy', 'Chicken rice or noodle?'],
    ['surprised', 'How many bowls?'],
    ['happy', 'You want drink?'],
  ]

  const emotions = []
  for (const [emotion, reply] of turns) emotions.push(await emotionFor(emotion, reply))

  assert.deepEqual(emotions, ['neutral', 'happy', 'surprised', 'happy'])
  assert.ok(!emotions.includes('confused'), 'no longer degenerate')
})

test('2.9: anger without an exclamation mark no longer falls through the mad branch', async () => {
  // Was: detectNpcEmotion("Don't be rude.") !== 'mad' — "rude" was in the outer list but not the
  // inner guard, and there was no "!", so it fell through to surprised and then happy.
  assert.equal(await emotionFor('mad', "Don't be rude."), 'mad')
})

test('2.9: a farewell is no longer read as happy because "goodbye" contains "good"', async () => {
  // Was: detectNpcEmotion('Goodbye.') === 'happy' on a substring match.
  assert.equal(await emotionFor('neutral', 'Goodbye.'), 'neutral')
})

test('2.9: the emotion can only ever be one of the six that have a sprite', async () => {
  // ScenarioStage interpolates it straight into /npc/uncle/{emotion}.png, so a seventh label is a
  // 404. v1 had no validation at all; the enum is now enforced by the schema.
  for (const emotion of NPC_EMOTIONS) {
    assert.equal(await emotionFor(emotion, 'Anything? Yes!'), emotion)
  }
})
