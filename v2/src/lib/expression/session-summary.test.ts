import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildEmotionSummary } from '@/lib/expression/session-summary'
import type { SessionEventRow } from '@/lib/session/types'

const event = (
  seq: number,
  type: SessionEventRow['type'],
  payload: Record<string, unknown>,
): SessionEventRow => ({ seq, type, payload, createdAt: new Date(0) })

const npcTurn = (seq: number, expression: Record<string, unknown> | null) =>
  event(seq, 'npc_response', { content: 'Yes?', npcEmotion: 'neutral', learnerExpression: expression })

const observed = (summaryEmotion: string, learnerEmotion: string | null) => ({
  summaryEmotion,
  explanation: 'smile 0.8 -> 0.1, over 9s across 10 samples',
  avgScore: 0.5,
  learnerEmotion,
  sampleCount: 10,
})

test('returns null when no turn carried a face, which reads as "Not available" in the prompt', () => {
  assert.equal(buildEmotionSummary([npcTurn(0, null), npcTurn(1, null)]), null)
})

test('returns null for a session recorded before Phase 3, where the field is absent entirely', () => {
  const legacy = event(0, 'npc_response', { content: 'Yes?', npcEmotion: 'neutral' })
  assert.equal(buildEmotionSummary([legacy]), null)
})

test('reports the arc turn by turn rather than percentages over the whole session', () => {
  // v1 counted 1fps rows into "neutral 62%, happy 21%" in the browser
  // (therapist/sessions/[sessionId]/page.tsx:88-96), which loses when the learner was struggling.
  const summary = buildEmotionSummary([
    npcTurn(0, observed('relaxed', 'content')),
    npcTurn(1, observed('tense', 'frustrated')),
  ])
  assert.equal(
    summary,
    'Face visible for 2 of 2 turns. By turn: relaxed (content), tense (frustrated).',
  )
})

test('counts turns where the camera saw nothing against the total', () => {
  const summary = buildEmotionSummary([
    npcTurn(0, observed('relaxed', 'content')),
    npcTurn(1, null),
    npcTurn(2, null),
  ])
  assert.match(summary!, /^Face visible for 1 of 3 turns\./)
})

test('says unlabelled when the model returned no label for a window it was given', () => {
  const summary = buildEmotionSummary([npcTurn(0, observed('still', null))])
  assert.match(summary!, /still \(unlabelled\)/)
})

test('ignores every event type that is not an NPC turn', () => {
  const summary = buildEmotionSummary([
    event(0, 'session_start', {}),
    event(1, 'icon_selection', { icons: ['rice'] }),
    npcTurn(2, observed('focused', 'neutral')),
    event(3, 'heart_lost', { reason: 'timeout' }),
  ])
  assert.equal(summary, 'Face visible for 1 of 1 turns. By turn: focused (neutral).')
})
