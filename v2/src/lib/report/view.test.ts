import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildEmotionTimeline } from '@/lib/report/timeline'
import { buildReport, endingLabel } from '@/lib/report/view'
import type { SessionEventRow, SessionRow } from '@/lib/session/types'

const T0 = new Date('2026-09-13T10:00:00Z')
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000)

const session = (overrides: Partial<SessionRow> = {}): SessionRow => ({
  id: 'a3f1',
  scenarioId: 'hawker_centre',
  mode: 'learning',
  persona: 'steady_turtle',
  personaClassified: null,
  status: 'completed',
  hearts: 5,
  turnIndex: 2,
  eventTriggerTurn: null,
  eventId: null,
  endReason: 'farewell',
  startedAt: T0,
  endedAt: at(120),
  competenceScores: null,
  scoredAt: null,
  scoringState: 'pending',
  scoringError: null,
  ...overrides,
})

let seq = 0
const event = (
  type: SessionEventRow['type'],
  payload: Record<string, unknown>,
  seconds: number,
): SessionEventRow => ({ seq: seq++, type, payload, createdAt: at(seconds) })

const expression = (summaryEmotion: string, learnerEmotion: string | null) => ({
  summaryEmotion,
  explanation: 'smile 0.4 -> 0.1, over 9s across 9 samples',
  avgScore: 0.4,
  learnerEmotion,
  sampleCount: 9,
})

const LOG: SessionEventRow[] = [
  event('session_start', {}, 0),
  event('icon_selection', { icons: ['i', 'want'], translated: 'I want', turnIndex: 0 }, 10),
  event(
    'npc_response',
    { content: 'Want what?', npcEmotion: 'confused', turnIndex: 0, learnerExpression: expression('tense', 'anxious') },
    14,
  ),
  event('icon_selection', { icons: ['rice'], translated: 'Rice', turnIndex: 1 }, 30),
  event(
    'npc_response',
    { content: 'Here you go!', npcEmotion: 'happy', turnIndex: 1, learnerExpression: expression('relaxed', 'content') },
    34,
  ),
  event('session_end', { reason: 'farewell' }, 120),
]

const GOOD_SCORES = {
  operational: 72,
  linguistic: 64,
  social: 80,
  strategic: 35,
  confidence: 70,
  summary: 'Ordered successfully after one repair.',
}

test('the report carries the transcript, the turn count and the duration', () => {
  const view = buildReport(session(), LOG)

  assert.equal(view.turnCount, 2)
  assert.equal(view.durationMs, 120_000)
  assert.equal(view.transcript.length, 4, 'two learner turns and two NPC turns')
  assert.equal(view.transcript[0].role, 'learner')
})

test('a scored session exposes the validated scores and the mean of what was observed', () => {
  const view = buildReport(session({ competenceScores: GOOD_SCORES, scoringState: 'scored' }), LOG)

  assert.equal(view.scoring.state, 'scored')
  assert.equal(view.scoring.state === 'scored' && view.scoring.overall, (72 + 64 + 80 + 35 + 70) / 5)
})

test('a not-observed strategic score is not averaged in as a zero', () => {
  const view = buildReport(
    session({ competenceScores: { ...GOOD_SCORES, strategic: null }, scoringState: 'scored' }),
    LOG,
  )

  assert.equal(view.scoring.state === 'scored' && view.scoring.overall, (72 + 64 + 80 + 70) / 4)
})

test('a stored payload that no longer satisfies the schema reads as failed, never as a score', () => {
  // v1 rendered whatever was in the column on a therapist's radar chart with no validation at all.
  const view = buildReport(
    session({ competenceScores: { operational: 50, summary: 'x' }, scoringState: 'scored' }),
    LOG,
  )

  assert.equal(view.scoring.state, 'failed')
})

test('each non-scored state is distinguishable, which is why 0003 exists', () => {
  const cases = [
    ['running', 'running'],
    ['skipped', 'skipped'],
    ['failed', 'failed'],
  ] as const

  for (const [scoringState, expected] of cases) {
    const view = buildReport(session({ scoringState }), LOG)
    assert.equal(view.scoring.state, expected, scoringState)
  }
})

test('an ended session still marked pending reads as failed, not as still running', () => {
  // Nobody is coming back for it: after() already had its chance inside the end invocation.
  assert.equal(buildReport(session({ scoringState: 'pending' }), LOG).scoring.state, 'failed')
})

test('a live session is unscored rather than failed', () => {
  const view = buildReport(session({ status: 'active', endReason: null, endedAt: null }), LOG)

  assert.equal(view.scoring.state, 'unscored')
  assert.equal(view.durationMs, null)
})

test('the failure kind survives to the page so the reader is told what went wrong', () => {
  const view = buildReport(session({ scoringState: 'failed', scoringError: 'rate_limited' }), LOG)
  assert.equal(view.scoring.state === 'failed' && view.scoring.errorKind, 'rate_limited')
})

test('every end reason has its own headline, including the turn cap', () => {
  const label = (endReason: SessionRow['endReason']) =>
    endingLabel(buildReport(session({ endReason }), LOG))

  assert.equal(label('farewell'), 'Completed')
  assert.equal(label('turn_cap'), 'Reached the turn limit')
  assert.equal(label('hearts_exhausted'), 'Ran out of hearts')
  assert.equal(label('manual'), 'Ended early')
  assert.notEqual(label('turn_cap'), label('farewell'), 'finding S11: these are not the same event')
})

// ── Timeline ─────────────────────────────────────────────────────────────────

test('the timeline is one point per turn, on the session clock', () => {
  const timeline = buildEmotionTimeline(LOG)

  assert.equal(timeline.points.length, 2)
  assert.equal(timeline.npcTurns, 2)
  assert.equal(timeline.totalSamples, 18)
  assert.deepEqual(
    timeline.points.map((p) => p.atMs),
    [14_000, 34_000],
  )
  assert.deepEqual(
    timeline.points.map((p) => p.summaryEmotion),
    ['tense', 'relaxed'],
  )
})

test('the NPC emotion rides along, so a breakdown is visible next to the face that met it', () => {
  const timeline = buildEmotionTimeline(LOG)
  assert.equal(timeline.points[0].npcEmotion, 'confused')
  assert.equal(timeline.points[1].npcEmotion, 'happy')
})

test('a turn with no face is left out rather than drawn as neutral', () => {
  // v1's expression-service returned neutral at 100% on every error path
  // (expression-service/main.py:91-93), so a failed detection became an observation.
  const noFace: SessionEventRow[] = [
    event('session_start', {}, 0),
    event('npc_response', { content: 'Hi', npcEmotion: 'happy', turnIndex: 0 }, 5),
    event(
      'npc_response',
      { content: 'Yes?', npcEmotion: 'neutral', turnIndex: 1, learnerExpression: expression('still', null) },
      9,
    ),
  ]
  const timeline = buildEmotionTimeline(noFace)

  assert.equal(timeline.points.length, 1)
  assert.equal(timeline.npcTurns, 2, 'the denominator still counts the turn')
  assert.equal(timeline.points[0].learnerEmotion, null, 'an unlabelled window is still a reading')
})

test('a session with no camera at all yields an empty timeline, not an error', () => {
  const timeline = buildEmotionTimeline([
    event('session_start', {}, 0),
    event('npc_response', { content: 'Hi', npcEmotion: 'happy', turnIndex: 0 }, 5),
  ])

  assert.deepEqual(timeline.points, [])
  assert.equal(timeline.npcTurns, 1)
})

test('an empty log is handled rather than read off the end', () => {
  assert.deepEqual(buildEmotionTimeline([]), { points: [], npcTurns: 0, totalSamples: 0 })
})
