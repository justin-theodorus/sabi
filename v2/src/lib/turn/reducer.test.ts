// No mocks, no fake timers, no React. The reducer is a pure function of (state, action), which
// is the point: the bug class it replaces (v1's stale-closure timer races, findings 3.3 and 3.4)
// was untestable precisely because it lived in setTimeout closures over React state.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { AACIcon } from '@/components/AACBoard'
import { MAX_EXPRESSION_SAMPLES } from '@/lib/expression/schema'
import { ZERO_SIGNALS } from '@/lib/expression/signals'
import { BUMP_MS, SURVIVAL_TIMEOUT_MS } from '@/lib/turn/constants'
import { initialState, secondsLeft, turnReducer } from '@/lib/turn/reducer'
import type { Effect, SessionConfig, TurnAction, TurnState } from '@/lib/turn/types'

const T0 = 1_000_000

const config = (mode: 'learning' | 'survival'): SessionConfig => ({
  scenarioId: 'hawker_centre',
  mode,
  persona: 'steady_turtle',
})

const icon = (id: string): AACIcon => ({
  id,
  label: id,
  category: 'core_words',
  imageUrl: `/icons/core_words/${id}.png`,
})

const run = (state: TurnState, ...actions: TurnAction[]): TurnState =>
  actions.reduce(turnReducer, state)

/**
 * A session that has been created and is sitting at idle, board empty, with the createSession
 * effect settled the way the real drain settles it. Without that last step every later
 * assertion on the effect queue would be reading a leftover.
 */
const started = (mode: 'learning' | 'survival' = 'learning'): TurnState => {
  const starting = turnReducer(initialState(config(mode), T0), { type: 'START_REQUESTED', now: T0 })
  return run(
    starting,
    { type: 'SESSION_STARTED', sessionId: 's1', hearts: 5, greeting: 'Hello!', now: T0 },
    { type: 'EFFECT_SETTLED', id: starting.pending[0].id },
  )
}

const effectKinds = (state: TurnState) => state.pending.map((e) => e.kind)

/** Settles every queued effect, as the real drain does, so the next assertion sees only new work. */
const drain = (state: TurnState): TurnState =>
  state.pending.reduce((s, e) => turnReducer(s, { type: 'EFFECT_SETTLED', id: e.id }), state)

/** A survival session that has already completed one learner turn, so the judge applies. */
const survivalAfterOneTurn = (hearts = 5): TurnState => {
  const after = run(
    started('survival'),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_DELTA', text: 'What?' },
    { type: 'STREAM_FINISHED', now: T0 + 1000 },
  )
  return { ...drain(after), hearts }
}

// ── Session start ────────────────────────────────────────────────────────────

test('starting enqueues exactly one createSession effect', () => {
  const state = turnReducer(initialState(config('learning'), T0), { type: 'START_REQUESTED', now: T0 })
  assert.deepEqual(effectKinds(state), ['createSession'])
})

test('a second start request while starting is ignored, so no duplicate session is created', () => {
  // v1's init effect ran twice under StrictMode and issued two POST /sessions.
  const once = turnReducer(initialState(config('learning'), T0), { type: 'START_REQUESTED', now: T0 })
  const twice = turnReducer(once, { type: 'START_REQUESTED', now: T0 })
  assert.deepEqual(effectKinds(twice), ['createSession'])
})

test('a retried start gets a fresh effect id, so the drain cannot mistake it for the first one', () => {
  // The Phase 1 defect: effect ids were `${kind}:${turnIndex}:${transcript.length}:${pending.length}`
  // and SESSION_FAILED moves none of those three, so the retry regenerated `createSession:0:0:0`.
  // use-turn.ts remembers started ids forever and never prunes them, so the second attempt was
  // filtered out, no fetch ran, EFFECT_SETTLED never fired, and the phase sat at `submitting` with
  // no error and no way out but a page reload.
  const first = turnReducer(initialState(config('learning'), T0), { type: 'START_REQUESTED', now: T0 })
  const retried = run(
    first,
    { type: 'SESSION_FAILED', kind: 'network' },
    { type: 'EFFECT_SETTLED', id: first.pending[0].id },
    { type: 'START_REQUESTED', now: T0 + 5000 },
  )

  assert.equal(retried.phase, 'submitting')
  assert.deepEqual(effectKinds(retried), ['createSession'])
  assert.notEqual(retried.pending[0].id, first.pending[0].id)
})

test('every effect id in a session is unique, which is what the drain relies on', () => {
  // The same defect bit any retry from a numerically identical state, not just the first one: a
  // dialogue turn that failed before STREAM_STARTED left transcript.length and turnIndex untouched.
  const failedTurn = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_FAILED', kind: 'network', now: T0 + 500 },
  )
  const retried = run(
    drain(failedTurn),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 1000 },
  )

  assert.deepEqual(effectKinds(retried), ['dialogue'])

  const ids = [failedTurn.pending[0].id, retried.pending[0].id]
  assert.equal(new Set(ids).size, ids.length)
})

test('the greeting opens the transcript but the session begins at turn zero', () => {
  const state = started()
  assert.equal(state.phase, 'idle')
  assert.deepEqual(state.transcript, [{ role: 'npc', text: 'Hello!', npcEmotion: 'neutral' }])
  assert.equal(state.turnIndex, 0)
})

// ── Selection ────────────────────────────────────────────────────────────────

test('icons can be selected, removed by index, and cleared', () => {
  let state = run(started(), { type: 'ICON_SELECTED', icon: icon('i') }, { type: 'ICON_SELECTED', icon: icon('want') })
  assert.deepEqual(state.selected.map((s) => s.id), ['i', 'want'])

  state = turnReducer(state, { type: 'ICON_REMOVED', index: 0 })
  assert.deepEqual(state.selected.map((s) => s.id), ['want'])

  state = turnReducer(state, { type: 'SELECTION_CLEARED' })
  assert.deepEqual(state.selected, [])
})

test('icons cannot be selected while a stream is in flight', () => {
  const streaming = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('i') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
  )
  const after = turnReducer(streaming, { type: 'ICON_SELECTED', icon: icon('want') })
  assert.deepEqual(after.selected, [])
})

test('submitting an empty board does nothing', () => {
  const state = turnReducer(started(), { type: 'SUBMIT_REQUESTED', now: T0 })
  assert.equal(state.phase, 'idle')
  assert.deepEqual(effectKinds(state), [])
})

// ── The happy-path turn ──────────────────────────────────────────────────────

test('a learning-mode submit goes straight to dialogue, with no judge call', () => {
  const state = run(started(), { type: 'ICON_SELECTED', icon: icon('rice') }, { type: 'SUBMIT_REQUESTED', now: T0 })
  assert.equal(state.phase, 'submitting')
  assert.deepEqual(effectKinds(state), ['dialogue'])
})

test('a complete turn lands both sides in the transcript and returns to idle', () => {
  const state = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_DELTA', text: 'Okay ' },
    { type: 'STREAM_DELTA', text: 'lah.' },
    {
      type: 'STREAM_METADATA', turnIndex: 1, hearts: 5, npcEmotion: 'neutral',
      completion: null, learnerText: 'Rice', activeEventLine: null,
    },
    { type: 'STREAM_FINISHED', now: T0 + 3000 },
  )

  assert.equal(state.phase, 'idle')
  assert.equal(state.turnIndex, 1)
  assert.equal(state.streamingText, '')
  assert.deepEqual(state.transcript.slice(1), [
    { role: 'learner', text: 'Rice' },
    { role: 'npc', text: 'Okay lah.', npcEmotion: 'neutral' },
  ])
})

test("the server's translated text replaces the client's guess in the transcript", () => {
  const state = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('i') },
    { type: 'ICON_SELECTED', icon: icon('want') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    {
      type: 'STREAM_METADATA', turnIndex: 1, hearts: 5, npcEmotion: 'neutral',
      completion: null, learnerText: 'I want', activeEventLine: null,
    },
  )
  assert.equal(state.transcript.at(-1)?.text, 'I want')
})

test('the board clears when the stream opens, not when the icons are submitted', () => {
  const submitted = run(started(), { type: 'ICON_SELECTED', icon: icon('rice') }, { type: 'SUBMIT_REQUESTED', now: T0 })
  assert.equal(submitted.selected.length, 1)
  assert.equal(turnReducer(submitted, { type: 'STREAM_STARTED' }).selected.length, 0)
})

// ── Stream failure, finding 3.1 ──────────────────────────────────────────────

test('a failed stream surfaces an error and writes no partial NPC turn', () => {
  const state = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_DELTA', text: 'Okay' },
    { type: 'STREAM_FAILED', kind: 'rate_limited', now: T0 + 1000 },
  )

  assert.equal(state.phase, 'idle')
  assert.deepEqual(state.error, { kind: 'rate_limited' })
  assert.equal(state.streamingText, '')
  // v1 appended an empty assistant message here, corrupting every later turn.
  assert.ok(!state.transcript.some((turn) => turn.role === 'npc' && turn.text === ''))
  assert.equal(state.transcript.filter((t) => t.role === 'npc').length, 1) // just the greeting
})

test('the learner can take another turn after a failure', () => {
  const failed = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_FAILED', kind: 'stream_failed', now: T0 + 1000 },
  )
  const retry = run(failed, { type: 'ICON_SELECTED', icon: icon('rice') }, { type: 'SUBMIT_REQUESTED', now: T0 + 2000 })
  assert.equal(retry.phase, 'submitting')
  assert.equal(retry.error, null)
})

// ── The tick, finding 3.4 ────────────────────────────────────────────────────

test('a tick during streaming is a no-op, so a bump can never race a stream', () => {
  const streaming = run(
    started('survival'),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
  )
  const ticked = turnReducer(streaming, { type: 'TICK', now: T0 + 10 * SURVIVAL_TIMEOUT_MS })

  assert.equal(ticked, streaming) // identity: literally nothing happened
})

test('a tick before the bump threshold does nothing', () => {
  const state = started('learning')
  assert.equal(turnReducer(state, { type: 'TICK', now: T0 + BUMP_MS.learning - 1 }), state)
})

test('silence past the bump threshold enqueues one npc-initiated dialogue', () => {
  const state = turnReducer(started('learning'), { type: 'TICK', now: T0 + BUMP_MS.learning })
  assert.equal(state.phase, 'bumping')
  assert.deepEqual(effectKinds(state), ['dialogue'])
  assert.equal(state.pending[0].kind === 'dialogue' && state.pending[0].npcInitiated, true)
})

test('survival bumps sooner than learning', () => {
  const atSurvivalThreshold = T0 + BUMP_MS.survival
  assert.equal(turnReducer(started('survival'), { type: 'TICK', now: atSurvivalThreshold }).phase, 'bumping')
  assert.equal(turnReducer(started('learning'), { type: 'TICK', now: atSurvivalThreshold }).phase, 'idle')
})

test('a bump increments the turn index, unlike v1', () => {
  const state = run(
    started('learning'),
    { type: 'TICK', now: T0 + BUMP_MS.learning },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_DELTA', text: 'Oi, you still there?' },
    {
      type: 'STREAM_METADATA', turnIndex: 1, hearts: 5, npcEmotion: 'confused',
      completion: null, learnerText: '', activeEventLine: null,
    },
    { type: 'STREAM_FINISHED', now: T0 + BUMP_MS.learning + 1000 },
  )
  assert.equal(state.turnIndex, 1)
  // A bump adds no learner turn.
  assert.equal(state.transcript.filter((t) => t.role === 'learner').length, 0)
})

test('the bump timer restarts after the bump completes', () => {
  const done = run(
    started('learning'),
    { type: 'TICK', now: T0 + BUMP_MS.learning },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_DELTA', text: 'Hello?' },
    { type: 'STREAM_FINISHED', now: T0 + 25_000 },
  )
  assert.equal(done.phase, 'idle')
  assert.equal(turnReducer(done, { type: 'TICK', now: 25_500 + T0 }).phase, 'idle')
  assert.equal(turnReducer(done, { type: 'TICK', now: T0 + 25_000 + BUMP_MS.learning }).phase, 'bumping')
})

// ── Hearts, finding 3.3 ──────────────────────────────────────────────────────

test('learning mode never loses a heart to the survival timeout', () => {
  const state = turnReducer(started('learning'), { type: 'TICK', now: T0 + SURVIVAL_TIMEOUT_MS })
  assert.equal(state.hearts, 5)
})

test('survival silence past the timeout costs one heart and logs it once', () => {
  const state = turnReducer(started('survival'), { type: 'TICK', now: T0 + SURVIVAL_TIMEOUT_MS })
  assert.equal(state.hearts, 4)
  assert.deepEqual(effectKinds(state), ['logEvent'])
})

test('the survival timeout does not re-charge on every subsequent tick', () => {
  const charged = turnReducer(started('survival'), { type: 'TICK', now: T0 + SURVIVAL_TIMEOUT_MS })
  const later = run(
    charged,
    { type: 'TICK', now: T0 + SURVIVAL_TIMEOUT_MS + 1000 },
    { type: 'TICK', now: T0 + SURVIVAL_TIMEOUT_MS + 2000 },
  )
  assert.equal(later.hearts, 4)
})

test('the survival timeout re-arms after the learner acts again', () => {
  const charged = turnReducer(started('survival'), { type: 'TICK', now: T0 + SURVIVAL_TIMEOUT_MS })
  const acted = run(
    charged,
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 31_000 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_FINISHED', now: T0 + 32_000 },
  )
  const timedOutAgain = turnReducer(acted, { type: 'TICK', now: T0 + 32_000 + SURVIVAL_TIMEOUT_MS })
  assert.equal(timedOutAgain.hearts, 3)
})

test('the last heart ends the session exactly once', () => {
  let state = { ...started('survival'), hearts: 1 }
  state = turnReducer(state, { type: 'HEART_LOST', reason: 'timeout', now: T0 + 100 })

  assert.equal(state.phase, 'over')
  assert.equal(state.endReason, 'hearts_exhausted')
  assert.equal(state.pending.filter((e) => e.kind === 'endSession').length, 1)
})

test('further actions after the session is over change nothing', () => {
  const over = turnReducer({ ...started('survival'), hearts: 1 }, { type: 'HEART_LOST', reason: 'timeout', now: T0 })
  const after = run(
    over,
    { type: 'HEART_LOST', reason: 'timeout', now: T0 + 1000 },
    { type: 'END_REQUESTED', reason: 'manual' },
    { type: 'TICK', now: T0 + 999_999 },
    { type: 'ICON_SELECTED', icon: icon('rice') },
  )
  assert.equal(after.pending.filter((e) => e.kind === 'endSession').length, 1)
  assert.equal(after.phase, 'over')
})

// ── The off-context judge ────────────────────────────────────────────────────

test('survival routes the first learner turn straight to dialogue, with nothing to judge against', () => {
  const state = run(started('survival'), { type: 'ICON_SELECTED', icon: icon('rice') }, { type: 'SUBMIT_REQUESTED', now: T0 })
  assert.deepEqual(effectKinds(state), ['dialogue'])
})

test('survival judges subsequent turns before calling dialogue', () => {
  const second = run(
    survivalAfterOneTurn(),
    { type: 'ICON_SELECTED', icon: icon('tea') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 2000 },
  )
  assert.deepEqual(effectKinds(second), ['judge'])
})

test('an off-context verdict costs a heart and still runs the turn', () => {
  const submitting = drain(run(
    survivalAfterOneTurn(),
    { type: 'ICON_SELECTED', icon: icon('tea') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 2000 },
  ))
  const judged = turnReducer(submitting, { type: 'JUDGE_VERDICT', offContext: true, expression: null, icons: ['tea'], now: T0 + 2000 })
  assert.equal(judged.hearts, 4)
  assert.deepEqual(effectKinds(judged), ['logEvent', 'dialogue'])
})

test('an off-context verdict on the last heart ends the session without calling dialogue', () => {
  const submitting = drain(run(
    survivalAfterOneTurn(1),
    { type: 'ICON_SELECTED', icon: icon('tea') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 2000 },
  ))
  const judged = turnReducer(submitting, { type: 'JUDGE_VERDICT', offContext: true, expression: null, icons: ['tea'], now: T0 + 2000 })
  assert.equal(judged.phase, 'over')
  assert.ok(!effectKinds(judged).includes('dialogue'))
  assert.equal(judged.pending.filter((e) => e.kind === 'endSession').length, 1)
})

// ── Completion and effects ───────────────────────────────────────────────────

test('a farewell from the server ends the session when the stream finishes', () => {
  const state = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('bye') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_DELTA', text: 'Here you go, come again!' },
    {
      type: 'STREAM_METADATA', turnIndex: 7, hearts: 5, npcEmotion: 'happy',
      completion: 'farewell', learnerText: 'Bye', activeEventLine: null,
    },
    { type: 'STREAM_FINISHED', now: T0 + 2000 },
  )
  assert.equal(state.phase, 'over')
  assert.equal(state.endReason, 'farewell')
  // The NPC's closing line is still shown.
  assert.equal(state.transcript.at(-1)?.text, 'Here you go, come again!')
})

test('settled effects are removed from the queue by id', () => {
  const state = turnReducer(initialState(config('learning'), T0), { type: 'START_REQUESTED', now: T0 })
  const id = state.pending[0].id
  assert.deepEqual(turnReducer(state, { type: 'EFFECT_SETTLED', id }).pending, [])
})

test('settling an unknown effect id leaves the queue alone', () => {
  const state = turnReducer(initialState(config('learning'), T0), { type: 'START_REQUESTED', now: T0 })
  assert.equal(turnReducer(state, { type: 'EFFECT_SETTLED', id: 'nope' }).pending.length, 1)
})

// ── Derived countdown ────────────────────────────────────────────────────────

test('the countdown is derived from last activity, not stored', () => {
  const state = started('survival')
  assert.equal(secondsLeft(state, T0), 30)
  assert.equal(secondsLeft(state, T0 + 10_000), 20)
  assert.equal(secondsLeft(state, T0 + SURVIVAL_TIMEOUT_MS), 0)
})

test('the countdown does not run while the NPC is replying', () => {
  const streaming = run(
    started('survival'),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
  )
  assert.equal(secondsLeft(streaming, T0 + 29_000), 30)
})

// ── The expression window (Phase 3) ──────────────────────────────────────────

const signals = (smile: number) => ({ ...ZERO_SIGNALS, smile })

const sample = (state: TurnState, at: number, smile = 0.5): TurnState =>
  turnReducer(state, { type: 'EXPRESSION_SAMPLED', signals: signals(smile), now: at })

const dialogueEffect = (state: TurnState) =>
  state.pending.find((e) => e.kind === 'dialogue') as Extract<Effect, { kind: 'dialogue' }>

test('samples accumulate while the learner is composing', () => {
  const state = sample(sample(started(), T0), T0 + 1000)
  assert.equal(state.expressionWindow.length, 2)
})

test('samples taken during a stream are dropped, because they are not the learner composing', () => {
  const streaming = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
  )
  assert.equal(sample(streaming, T0 + 1000).expressionWindow.length, 0)
})

test('the window is capped, dropping oldest, so a long compose cannot grow unbounded', () => {
  // v1 capped nothing: a 60-second turn sent 60 numbered lines into a 150-token call
  // (frontend/src/lib/emotion-summary.ts:38-42).
  let state = started()
  for (let i = 0; i < MAX_EXPRESSION_SAMPLES + 10; i++) state = sample(state, T0 + i * 1000, i / 100)
  assert.equal(state.expressionWindow.length, MAX_EXPRESSION_SAMPLES)
  assert.equal(state.expressionWindow.at(-1)?.at, T0 + (MAX_EXPRESSION_SAMPLES + 9) * 1000)
})

test('submitting hands the window to the dialogue effect, rebased so no wall clock goes on the wire', () => {
  const state = run(
    sample(sample(started(), T0), T0 + 2000),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 2000 },
  )
  assert.deepEqual(
    dialogueEffect(state).expression?.map((s) => s.at),
    [0, 2000],
  )
  assert.equal(state.expressionWindow.length, 0)
})

test('a turn with no samples sends null, not an empty window', () => {
  const state = run(
    started(),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
  )
  assert.equal(dialogueEffect(state).expression, null)
})

test('a failed turn does not carry its samples into the next one', () => {
  // Finding 3.8. v1 called resetEmotionLog() only after a successful streamDialogue
  // (session/page.tsx:575) and not in the catch below it, so the NPC's next reply reacted to a
  // face the learner made during a turn that errored. Clearing at submit closes it by
  // construction rather than by remembering to add a second reset.
  const failed = run(
    sample(started(), T0),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 },
    { type: 'STREAM_STARTED' },
    { type: 'STREAM_FAILED', kind: 'timeout', now: T0 + 1000 },
  )
  assert.equal(failed.expressionWindow.length, 0)

  const retried = run(
    drain(failed),
    { type: 'ICON_SELECTED', icon: icon('rice') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 2000 },
  )
  assert.equal(dialogueEffect(retried).expression, null)
})

test('survival carries the window through the judge hop', () => {
  const submitting = drain(run(
    sample(survivalAfterOneTurn(), T0 + 2000),
    { type: 'ICON_SELECTED', icon: icon('tea') },
    { type: 'SUBMIT_REQUESTED', now: T0 + 2000 },
  ))
  const judged = turnReducer(submitting, {
    type: 'JUDGE_VERDICT',
    offContext: false,
    icons: ['tea'],
    expression: [{ at: 0, signals: signals(0.5) }],
    now: T0 + 2000,
  })
  assert.equal(dialogueEffect(judged).expression?.length, 1)
})

test('an NPC bump sends the silence window, which is the whole signal a bump reacts to', () => {
  const silent = sample(started(), T0 + 1000)
  const bumped = turnReducer(silent, { type: 'TICK', now: T0 + BUMP_MS.learning + 1000 })
  assert.equal(bumped.phase, 'bumping')
  assert.equal(dialogueEffect(bumped).expression?.length, 1)
  assert.equal(bumped.expressionWindow.length, 0)
})
