import assert from 'node:assert/strict'
import { test } from 'node:test'

import { NoObjectGeneratedError } from 'ai'

import { classifyModelError } from '@/lib/ai/errors'
import { competenceScoresSchema, overallScore, SCORE_DIMENSIONS } from '@/lib/scoring/schema'
import { NotEnoughTurnsError, scoreSession } from '@/lib/scoring/score-session'
import { buildScoringTranscript } from '@/lib/scoring/transcript'
import type { EventType, SessionEventRow } from '@/lib/session/types'
import { apiCallError, failingModel, generatingModel } from '@/test/model-mock'

let seq = 0
const event = (type: EventType, payload: Record<string, unknown>): SessionEventRow => ({
  seq: seq++,
  type,
  payload,
  createdAt: new Date(0),
})

const TURNS = buildScoringTranscript([
  event('icon_selection', { icons: ['I want', 'rice'], translated: 'I want rice', turnIndex: 0 }),
  event('npc_response', { content: 'Chicken rice?', npcEmotion: 'happy', turnIndex: 0 }),
  event('icon_selection', { icons: ['yes', 'thank you'], translated: 'Yes thank you', turnIndex: 1 }),
  event('npc_response', { content: 'Here you go.', npcEmotion: 'happy', turnIndex: 1 }),
])

const GOOD = JSON.stringify({
  operational: 72,
  linguistic: 64,
  social: 80,
  strategic: 35,
  confidence: 70,
  summary: 'Ordered confidently but never had to repair a breakdown.',
})

const score = (text: string) =>
  scoreSession({ scenarioId: 'hawker_centre', turns: TURNS, model: generatingModel(text) })

test('a well-formed response is returned as validated scores', async () => {
  const scores = await score(GOOD)

  assert.equal(scores.operational, 72)
  assert.equal(scores.strategic, 35)
  assert.match(scores.summary, /repair/)
})

test('v1s exact silent-default trigger now produces no score at all', async () => {
  // main.py:793-797 did float(scores.get("operational", 50)) five times, so this response became
  // a complete, plausible 50/50/50/50/50 clinical record written to the database and fed into the
  // next session's difficulty calibration.
  await assert.rejects(
    () => score(JSON.stringify({ summary: 'Session scored successfully.' })),
    (error: unknown) => {
      assert.ok(NoObjectGeneratedError.isInstance(error))
      assert.equal(classifyModelError(error).kind, 'malformed_output')
      return true
    },
  )
})

test('a partially filled response is rejected rather than topped up', async () => {
  await assert.rejects(
    () => score(JSON.stringify({ operational: 70, summary: 'Only one dimension.' })),
    (error: unknown) => NoObjectGeneratedError.isInstance(error),
  )
})

test('an out-of-range score is rejected rather than clamped', async () => {
  // v1 did float(...) with no bounds check, so 4000 and -5 were written verbatim.
  await assert.rejects(
    () =>
      score(
        JSON.stringify({
          operational: 4000,
          linguistic: 50,
          social: 50,
          strategic: 50,
          confidence: 50,
          summary: 'Out of range.',
        }),
      ),
    (error: unknown) => NoObjectGeneratedError.isInstance(error),
  )
})

test('markdown fences no longer need stripping by hand', async () => {
  // v1's raw.split("```")[1] (main.py:787) was the workaround for this. Structured output means
  // the fence case does not arise; if it somehow does, it fails loudly rather than half-parsing.
  await assert.rejects(() => score('```json\n' + GOOD + '\n```'))
})

test('a session with too few turns is refused before any model call is made', async () => {
  const thin = buildScoringTranscript([
    event('icon_selection', { icons: ['hi'], translated: 'Hi', turnIndex: 0 }),
  ])

  await assert.rejects(
    () =>
      scoreSession({
        scenarioId: 'hawker_centre',
        turns: thin,
        // Would throw if it were ever reached.
        model: failingModel(new Error('the model must not be called')),
      }),
    (error: unknown) => error instanceof NotEnoughTurnsError,
  )
})

test('a provider failure propagates as itself, so the caller can classify it', async () => {
  await assert.rejects(
    () =>
      scoreSession({
        scenarioId: 'hawker_centre',
        turns: TURNS,
        model: failingModel(apiCallError(429, true)),
      }),
    (error: unknown) => {
      assert.equal(classifyModelError(error).kind, 'rate_limited')
      return true
    },
  )
})

test('the schema rejects every shape that v1 would have silently accepted', () => {
  const cases = [
    {},
    { summary: 'nothing else' },
    { operational: 50, linguistic: 50, social: 50, strategic: 50, confidence: 50 },
    { operational: '70', linguistic: 50, social: 50, strategic: 50, confidence: 50, summary: 'x' },
    { operational: -1, linguistic: 50, social: 50, strategic: 50, confidence: 50, summary: 'x' },
    { operational: 101, linguistic: 50, social: 50, strategic: 50, confidence: 50, summary: 'x' },
  ]

  for (const value of cases) {
    assert.equal(competenceScoresSchema.safeParse(value).success, false, JSON.stringify(value))
  }
})

test('overallScore averages the five dimensions and ignores the summary', () => {
  const scores = competenceScoresSchema.parse(JSON.parse(GOOD))
  const expected = SCORE_DIMENSIONS.reduce((total, key) => total + scores[key], 0) / 5

  assert.equal(overallScore(scores), expected)
  assert.equal(overallScore(scores), (72 + 64 + 80 + 35 + 70) / 5)
})
