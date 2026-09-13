// The turn state machine. Pure: no React, no I/O, no Date.now(), no Math.random().
//
// This file is the answer to findings 3.3 and 3.4, and it replaces the six manual refs at v1
// session/page.tsx:249-254 (historyRef, turnIndexRef, heartsRef, npcLoadingRef, sessionOverRef,
// rolledEventRef). Each of those mirrored a useState purely so a setTimeout callback could read
// a value that its closure had captured stale. A reducer receives current state at dispatch
// time, so there is no closure to go stale and nothing to mirror.
//
// Three v1 bugs are closed by construction rather than by a guard:
//
//  - A bump cannot start mid-stream. TICK only does anything in 'idle', and a stream is
//    'streaming'. v1 guarded on npcLoadingRef, which was assigned during render (:274) rather
//    than in the setter, leaving a window where a firing timer saw a stale false and issued a
//    second concurrent Claude call (3.4).
//  - The end of the session happens once. HEART_LOST at zero sets phase 'over' and enqueues one
//    endSession effect. v1 called endSessionFlow from inside a setHearts updater (3.3), so React
//    StrictMode ran the whole flow twice, then re-decided the same thing from a stale closure
//    200 lines away (:550).
//  - A bump increments turnIndex. v1's did not, so repeated silence produced N assistant turns
//    at the same index and session_complete (which needs turn_index >= 6) was unreachable by
//    bumps alone.

import { BUMP_MS, MAX_HEARTS, SURVIVAL_TIMEOUT_MS } from '@/lib/turn/constants'
import type { Effect, SessionConfig, TurnAction, TurnState } from '@/lib/turn/types'

export function initialState(config: SessionConfig, now: number): TurnState {
  return {
    config,
    phase: 'lobby',
    sessionId: null,
    selected: [],
    transcript: [],
    streamingText: '',
    hearts: MAX_HEARTS,
    turnIndex: 0,
    npcEmotion: 'neutral',
    activeEventLine: null,
    error: null,
    endReason: null,
    lastActivityAt: now,
    timeoutCharged: false,
    pending: [],
  }
}

/** Effect ids are derived from state, never random, so the reducer stays pure and testable. */
const effectId = (state: TurnState, kind: string): string =>
  `${kind}:${state.turnIndex}:${state.transcript.length}:${state.pending.length}`

const enqueue = (state: TurnState, effect: Effect): TurnState => ({
  ...state,
  pending: [...state.pending, effect],
})

/** Silence timers restart from here. */
const touch = (state: TurnState, now: number): TurnState => ({
  ...state,
  lastActivityAt: now,
  timeoutCharged: false,
})

export function turnReducer(state: TurnState, action: TurnAction): TurnState {
  switch (action.type) {
    case 'START_REQUESTED': {
      if (state.phase !== 'lobby') return state
      return enqueue(
        { ...touch(state, action.now), phase: 'submitting', error: null },
        { kind: 'createSession', id: effectId(state, 'createSession') },
      )
    }

    case 'SESSION_STARTED': {
      return {
        ...touch(state, action.now),
        phase: 'idle',
        sessionId: action.sessionId,
        hearts: action.hearts,
        // The greeting is the NPC's opening line. It is shown but never sent to the model as
        // history, matching v1 (session/page.tsx:311) — the model wrote no such line, so
        // attributing one to it would be a fabrication in the transcript.
        transcript: [{ role: 'npc', text: action.greeting, npcEmotion: 'neutral' }],
      }
    }

    case 'SESSION_FAILED':
      return { ...state, phase: 'lobby', error: { kind: 'session_failed', message: action.message } }

    case 'ICON_SELECTED':
      if (state.phase !== 'idle') return state
      return { ...state, selected: [...state.selected, action.icon] }

    case 'ICON_REMOVED':
      if (state.phase !== 'idle') return state
      return { ...state, selected: state.selected.filter((_, i) => i !== action.index) }

    case 'SELECTION_CLEARED':
      if (state.phase !== 'idle') return state
      return { ...state, selected: [] }

    case 'SUBMIT_REQUESTED': {
      if (state.phase !== 'idle' || state.selected.length === 0) return state

      const icons = state.selected.map((icon) => icon.label)
      const next = { ...touch(state, action.now), phase: 'submitting' as const, error: null }

      // Survival gates the turn on the off-context judge, which may cost a heart before the
      // dialogue call (finding S12 — deliberate, and the reason the heart is charged first is
      // that an off-context reply is the thing being penalised, not the NPC's reaction to it).
      if (state.config.mode === 'survival' && state.transcript.some((t) => t.role === 'learner')) {
        return enqueue(next, {
          kind: 'judge',
          id: effectId(state, 'judge'),
          learnerText: icons.join(' '),
          icons,
        })
      }

      return enqueue(next, { kind: 'dialogue', id: effectId(state, 'dialogue'), icons, npcInitiated: false })
    }

    case 'JUDGE_VERDICT': {
      if (state.phase !== 'submitting') return state

      const charged = action.offContext
        ? enqueue(
            { ...state, hearts: Math.max(state.hearts - 1, 0) },
            { kind: 'logEvent', id: effectId(state, 'heart'), type: 'heart_lost', payload: { reason: 'off_context' } },
          )
        : state

      // Out of hearts: the session ends here and the dialogue call is never made.
      if (charged.hearts <= 0) return endNow(charged, 'hearts_exhausted')

      return enqueue(charged, {
        kind: 'dialogue',
        id: effectId(charged, 'dialogue'),
        icons: action.icons,
        npcInitiated: false,
      })
    }

    case 'STREAM_STARTED': {
      if (state.phase !== 'submitting' && state.phase !== 'bumping') return state

      // The learner's turn joins the transcript as the stream opens, and the board clears. On a
      // bump there is no learner turn to add.
      const learnerText = state.selected.map((icon) => icon.label).join(' ')
      const isBump = state.phase === 'bumping'

      return {
        ...state,
        phase: 'streaming',
        selected: [],
        streamingText: '',
        transcript:
          isBump || learnerText.length === 0
            ? state.transcript
            : [...state.transcript, { role: 'learner', text: learnerText }],
      }
    }

    case 'STREAM_DELTA':
      if (state.phase !== 'streaming') return state
      return { ...state, streamingText: state.streamingText + action.text }

    case 'STREAM_METADATA': {
      if (state.phase !== 'streaming') return state

      // The server is authoritative for all of this. It also reports the learner's translated
      // text, which is what actually went to the model, so the transcript shows that rather than
      // the raw icon labels the client guessed at in STREAM_STARTED.
      const withLearnerText =
        action.learnerText.length > 0 && state.transcript.at(-1)?.role === 'learner'
          ? [...state.transcript.slice(0, -1), { role: 'learner' as const, text: action.learnerText }]
          : state.transcript

      return {
        ...state,
        transcript: withLearnerText,
        turnIndex: action.turnIndex,
        hearts: action.hearts,
        npcEmotion: action.npcEmotion,
        activeEventLine: action.activeEventLine,
        endReason: action.sessionComplete ? 'farewell' : state.endReason,
      }
    }

    case 'STREAM_FINISHED': {
      if (state.phase !== 'streaming') return state

      const reply = state.streamingText.trim()
      const settled: TurnState = {
        ...touch(state, action.now),
        streamingText: '',
        transcript: reply
          ? [...state.transcript, { role: 'npc', text: reply, npcEmotion: state.npcEmotion }]
          : state.transcript,
      }

      if (settled.endReason === 'farewell') return endNow(settled, 'farewell')
      return { ...settled, phase: 'idle' }
    }

    case 'STREAM_FAILED': {
      if (state.phase !== 'streaming' && state.phase !== 'submitting' && state.phase !== 'bumping') {
        return state
      }

      // The turn is abandoned whole. No partial NPC line is committed to the transcript, because
      // v1's silent failure wrote an empty assistant message into history (finding 3.1) and
      // corrupted the context of every subsequent turn. Returning to 'idle' lets the learner
      // retry; the timers resume from now.
      return {
        ...touch(state, action.now),
        phase: 'idle',
        streamingText: '',
        error: { kind: 'stream_failed', message: action.message },
      }
    }

    case 'HEART_LOST': {
      if (state.phase === 'over') return state

      const hearts = action.hearts ?? Math.max(state.hearts - 1, 0)
      const charged = { ...state, hearts, lastActivityAt: action.now, timeoutCharged: true }

      return hearts <= 0 ? endNow(charged, 'hearts_exhausted') : charged
    }

    case 'END_REQUESTED':
      if (state.phase === 'over') return state
      return endNow(state, action.reason)

    case 'EFFECT_SETTLED':
      return { ...state, pending: state.pending.filter((effect) => effect.id !== action.id) }

    case 'TICK':
      return tick(state, action.now)

    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

function endNow(state: TurnState, reason: TurnState['endReason']): TurnState {
  if (state.phase === 'over') return state
  const ended: TurnState = { ...state, phase: 'over', endReason: reason, selected: [] }
  return reason
    ? enqueue(ended, { kind: 'endSession', id: effectId(state, 'endSession'), reason })
    : ended
}

/**
 * The whole timer story.
 *
 * One 1s tick drives the countdown ring, the NPC bump, and the survival timeout. v1 ran three
 * separate timers for these (a 1s countdown interval, a 30s timeout, a 15/20s bump), which meant
 * the visible ring and the heart deduction were only coincidentally aligned, the timeout stayed
 * armed during a bump so a slow bump could cost a heart mid-sentence, and the timeout was never
 * re-armed after firing.
 *
 * A tick outside 'idle' is a no-op, which is what makes the stream/timer race unrepresentable.
 */
function tick(state: TurnState, now: number): TurnState {
  if (state.phase !== 'idle') return state

  const silent = now - state.lastActivityAt

  if (
    state.config.mode === 'survival' &&
    !state.timeoutCharged &&
    silent >= SURVIVAL_TIMEOUT_MS
  ) {
    const hearts = Math.max(state.hearts - 1, 0)
    const charged = enqueue(
      { ...state, hearts, lastActivityAt: now, timeoutCharged: true },
      { kind: 'logEvent', id: effectId(state, 'heart'), type: 'heart_lost', payload: { reason: 'timeout' } },
    )
    return hearts <= 0 ? endNow(charged, 'hearts_exhausted') : charged
  }

  if (silent >= BUMP_MS[state.config.mode]) {
    return enqueue(
      { ...state, phase: 'bumping', lastActivityAt: now },
      { kind: 'dialogue', id: effectId(state, 'bump'), icons: [], npcInitiated: true },
    )
  }

  return state
}

/** Seconds left before the survival timeout. Derived, never stored. */
export function secondsLeft(state: TurnState, now: number): number {
  if (state.config.mode !== 'survival' || state.phase !== 'idle') {
    return Math.ceil(SURVIVAL_TIMEOUT_MS / 1000)
  }
  const remaining = SURVIVAL_TIMEOUT_MS - (now - state.lastActivityAt)
  return Math.max(0, Math.ceil(remaining / 1000))
}
