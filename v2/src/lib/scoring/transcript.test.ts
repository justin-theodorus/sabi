import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildScoringTranscript,
  countLearnerTurns,
  renderScoringTranscript,
} from '@/lib/scoring/transcript'
import type { EventType, SessionEventRow } from '@/lib/session/types'

let seq = 0
const event = (type: EventType, payload: Record<string, unknown>): SessionEventRow => ({
  seq: seq++,
  type,
  payload,
  createdAt: new Date(0),
})

const LEARNER = (icons: string[], translated: string, turnIndex = 0) =>
  event('icon_selection', { icons, translated, turnIndex, npcInitiated: false })

const NPC = (content: string, npcEmotion = 'neutral', turnIndex = 0) =>
  event('npc_response', { content, npcEmotion, turnIndex, npcInitiated: false })

test('session_start and session_end carry no dialogue and are dropped', () => {
  const turns = buildScoringTranscript([
    event('session_start', { mode: 'learning' }),
    LEARNER(['I want', 'rice'], 'I want rice'),
    NPC('Chicken rice?'),
    event('session_end', { reason: 'farewell' }),
  ])

  assert.equal(turns.length, 2)
  assert.deepEqual(
    turns.map((t) => t.role),
    ['learner', 'npc'],
  )
})

test('a heart_lost is a note, not an empty NPC turn', () => {
  // v1's ternary made this an assistant turn with content '' — an invented, silent NPC line in a
  // transcript a clinical score was derived from.
  const turns = buildScoringTranscript([
    LEARNER(['I want', 'rice'], 'I want rice'),
    event('heart_lost', { reason: 'timeout' }),
    NPC('You still there?'),
  ])

  assert.deepEqual(
    turns.map((t) => t.role),
    ['learner', 'note', 'npc'],
  )
  assert.ok(!turns.some((t) => t.role === 'npc' && t.content === ''))
})

test('the icons survive into the transcript, not just their translation', () => {
  // Four of five dimensions grade AAC construction. v1 discarded the icons before the prompt was
  // built, so those dimensions had nothing to grade.
  const [turn] = buildScoringTranscript([LEARNER(['I want', 'chicken rice'], 'I want chicken rice')])

  assert.equal(turn.role, 'learner')
  assert.deepEqual(turn.role === 'learner' ? turn.icons : [], ['I want', 'chicken rice'])
})

test('a malformed payload degrades to empty rather than throwing', () => {
  const turns = buildScoringTranscript([
    event('icon_selection', { icons: 'not an array', translated: 42 }),
    event('npc_response', {}),
  ])

  assert.equal(turns.length, 2)
  assert.deepEqual(turns[0].role === 'learner' ? turns[0].icons : null, [])
  assert.equal(turns[0].role === 'learner' ? turns[0].translated : null, '')
  assert.equal(turns[1].role === 'npc' ? turns[1].npcEmotion : null, 'neutral')
})

test('countLearnerTurns counts only learner turns', () => {
  const turns = buildScoringTranscript([
    LEARNER(['hello'], 'Hello'),
    NPC('Hi'),
    event('heart_lost', { reason: 'off_context' }),
    LEARNER(['rice'], 'Rice'),
  ])

  assert.equal(countLearnerTurns(turns), 2)
})

test('the rendered transcript shows the icons beside the sentence', () => {
  const rendered = renderScoringTranscript(
    buildScoringTranscript([
      LEARNER(['I want', 'rice'], 'I want rice'),
      NPC('Chicken rice or duck rice?', 'happy'),
      event('heart_lost', { reason: 'timeout' }),
    ]),
  )

  assert.match(rendered, /Learner \[icons: I want \+ rice\]: I want rice/)
  assert.match(rendered, /NPC \(happy\): Chicken rice or duck rice\?/)
  assert.match(rendered, /\[heart lost: timeout\]/)
})

test('a prompted turn is marked so initiative is not miscredited', () => {
  const rendered = renderScoringTranscript(
    buildScoringTranscript([
      event('icon_selection', { icons: ['yes'], translated: 'Yes', turnIndex: 3, npcInitiated: true }),
    ]),
  )

  assert.match(rendered, /Learner \(prompted\)/)
})

test('a learner turn with no icons still renders legibly', () => {
  const rendered = renderScoringTranscript(buildScoringTranscript([LEARNER([], '')]))
  assert.match(rendered, /\[icons: \(none\)\]/)
})
