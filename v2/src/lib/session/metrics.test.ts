import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyPersona, personaConfidence } from '@/lib/persona/classify'
import { DEFAULT_ICONS_PER_MESSAGE, sessionMetrics } from '@/lib/session/metrics'
import { EVENT_TYPES, type EventType, type SessionEventRow } from '@/lib/session/types'

const T0 = new Date('2026-09-13T12:00:00Z').getTime()

let seq = 0
const event = (type: EventType, atMs: number, payload: Record<string, unknown> = {}): SessionEventRow =>
  ({ id: seq, sessionId: 's', seq: seq++, type, payload, createdAt: new Date(T0 + atMs) }) as SessionEventRow

/** A session where the learner took 4s, then 6s, to answer. */
const normalLog = (): SessionEventRow[] => {
  seq = 0
  return [
    event('session_start', 0),
    event('npc_response', 1_000, { content: 'What would you like?' }),
    event('icon_selection', 5_000, { icons: ['I', 'want', 'rice'] }),
    event('npc_response', 7_000, { content: 'Rice, okay!' }),
    event('icon_selection', 13_000, { icons: ['thank', 'you'] }),
  ]
}

test('think time is the gap between the NPC replying and the learner submitting', () => {
  const metrics = sessionMetrics(normalLog())
  assert.equal(metrics.avgResponseLatencyMs, 5_000, '(4000 + 6000) / 2')
  assert.equal(metrics.turnCount, 2)
  assert.equal(metrics.avgIconsPerMessage, 2.5)
})

test('a session with no selections falls back rather than dividing by zero', () => {
  seq = 0
  const metrics = sessionMetrics([event('session_start', 0)])
  assert.equal(metrics.turnCount, 0)
  assert.equal(metrics.avgIconsPerMessage, DEFAULT_ICONS_PER_MESSAGE)
  assert.equal(metrics.avgResponseLatencyMs, 0)
})

// ── The adjacency trap ────────────────────────────────────────────────────────────────────────
//
// This is the test that decided where Phase 5's measurement data lives. It is written as a
// characterisation test: it pins CURRENT behaviour, including the part that is fragile, so that
// anyone adding a session_events type finds out from CI instead of from a wrong clinical report.

test('ANY event interleaved between an npc_response and an icon_selection erases think time', () => {
  seq = 0
  const withInterloper: SessionEventRow[] = [
    event('session_start', 0),
    event('npc_response', 1_000, { content: 'What would you like?' }),
    // Exactly where a per-turn measurement row would have landed.
    event('heart_lost', 2_000, { reason: 'timeout' }),
    event('icon_selection', 5_000, { icons: ['I', 'want', 'rice'] }),
  ]

  const metrics = sessionMetrics(withInterloper)
  assert.equal(
    metrics.avgResponseLatencyMs,
    0,
    'think time is read by array adjacency, so one interleaved row drops the sample entirely',
  )
  assert.equal(metrics.turnCount, 1, 'and it does so silently: the turn itself is still counted')
})

test('the erased latency is not inert — it changes the persona a learner is given', () => {
  // Why the above matters. 0ms is not "unknown" to the classifier, it is "very fast", and the
  // learner this hurts most is the one the signal exists to find: slow, hesitant, two icons at a
  // time. A 25s think time is shy_chick, "needs confidence building". Lose the samples and the
  // same child reads as exploratory and flexible.
  const hesitant = (interleaved: boolean): SessionEventRow[] => {
    seq = 0
    const log: SessionEventRow[] = [event('session_start', 0)]
    let at = 1_000
    for (let turn = 0; turn < 2; turn += 1) {
      log.push(event('npc_response', at))
      // Mid-think, so it lands between the two events the latency is measured across.
      if (interleaved) log.push(event('heart_lost', at + 2_000, { reason: 'timeout' }))
      at += 25_000
      log.push(event('icon_selection', at, { icons: ['I', 'want'] }))
      at += 1_000
    }
    return log
  }

  const real = sessionMetrics(hesitant(false))
  const lost = sessionMetrics(hesitant(true))

  assert.equal(real.avgResponseLatencyMs, 25_000)
  assert.equal(lost.avgResponseLatencyMs, 0)

  assert.equal(classifyPersona(real).persona, 'shy_chick')
  assert.equal(classifyPersona(lost).persona, 'curious_monkey')
  assert.equal(
    personaConfidence(lost.avgResponseLatencyMs),
    1,
    'and the wrong answer is reported with full confidence',
  )
})

test('measurement data is not in the event log, which is what keeps the above hypothetical', () => {
  // If a future change adds a model_call (or any other) type to EVENT_TYPES, this fails and the
  // author is pointed at 0004_model_calls.sql for the reason it was kept out.
  assert.deepEqual([...EVENT_TYPES], [
    'session_start',
    'icon_selection',
    'npc_response',
    'heart_lost',
    'event_fired',
    'session_end',
  ])
})
