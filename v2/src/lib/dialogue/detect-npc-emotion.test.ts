import { test } from 'node:test'
import assert from 'node:assert/strict'

import { detectNpcEmotion } from '@/lib/dialogue/detect-npc-emotion'

// Correct behaviour.
const CORRECT: ReadonlyArray<readonly [string, string, string]> = [
  ['sad wins the first branch', 'Aiyah, sorry ah, no more chicken.', 'sad'],
  ['an explicit clarification request is confused', 'Huh. Say again.', 'confused'],
  ['an exclamation with an anger word is mad', 'You are being ridiculous!', 'mad'],
  ['a bare exclamation is mad', 'Wah lau, hurry up lah!', 'mad'],
  ['surprise words are surprised', 'Wow. Two bowls.', 'surprised'],
  ['gratitude is happy', 'Thanks ah, come again.', 'happy'],
  ['a flat statement is neutral', 'Chicken rice, five dollars.', 'neutral'],
]

for (const [name, reply, expected] of CORRECT) {
  test(name, () => assert.equal(detectNpcEmotion(reply), expected))
}

// Finding 2.9, pinned deliberately. These assert the CURRENT behaviour, which is wrong.
// When Phase 2 replaces the keyword classifier with a model-provided emotion, these tests are
// expected to fail and should be rewritten to the corrected expectations noted below.

test('2.9: any question mark short-circuits to confused before happy can fire', () => {
  // Should be happy: the uncle is thanking the customer.
  assert.equal(detectNpcEmotion('Thanks ah, what else you want?'), 'confused')
})

test('2.9: a question mark beats an exclamation mark, so anger reads as confusion', () => {
  // Should be mad.
  assert.equal(detectNpcEmotion('Oi! Are you serious?'), 'confused')
})

test('2.9: an NPC told to ask one question per turn is confused almost every turn', () => {
  const typicalReplies = [
    'What you want?',
    'Chicken rice or noodle?',
    'How many bowls?',
    'You want drink?',
  ]
  const emotions = typicalReplies.map(detectNpcEmotion)
  assert.deepEqual(emotions, ['confused', 'confused', 'confused', 'confused'])
})

test('2.9: the mad branch inner guard is narrower than its outer list', () => {
  // "rude" is in the outer list but not the inner one and there is no exclamation mark, so this
  // falls through mad entirely. Should be mad.
  assert.notEqual(detectNpcEmotion("Don't be rude."), 'mad')
})

test('2.9: substring matching fires on words that merely contain a keyword', () => {
  // "goodbye" contains "good", so a farewell reads as happy.
  assert.equal(detectNpcEmotion('Goodbye.'), 'happy')
})
