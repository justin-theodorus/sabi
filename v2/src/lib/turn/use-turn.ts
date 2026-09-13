'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

import { streamDialogue } from '@/lib/dialogue/client'
import { toTurnErrorKind } from '@/lib/dialogue/turn-failure'
import { initialState, turnReducer } from '@/lib/turn/reducer'
import { TICK_MS } from '@/lib/turn/constants'
import type { Effect, SessionConfig, TurnAction, TurnState } from '@/lib/turn/types'

/**
 * Wires the pure reducer to the network and to the clock.
 *
 * There is exactly one ref in this file, and it holds the set of effect ids already started — not
 * a mirror of any state value. v1 needed six mirror refs (session/page.tsx:249-254) because its
 * timer callbacks read React state through stale closures; a reducer receives current state at
 * dispatch time, so that entire category is gone.
 */
export function useTurn(config: SessionConfig) {
  const [state, dispatch] = useReducer(turnReducer, config, (c) => initialState(c, Date.now()))

  // Effects already dispatched. Needed because React StrictMode invokes effects twice in
  // development, which is exactly what made v1 create two sessions and run its whole
  // end-of-session flow twice (findings 3.3 and the init effect at session/page.tsx:307-341).
  const startedEffects = useRef(new Set<string>())
  const abortRef = useRef<AbortController | null>(null)

  // One clock for the countdown ring, the NPC bump, and the survival timeout. The reducer
  // decides what a tick means; the timer itself knows nothing.
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Cancel any in-flight request when the page goes away.
  useEffect(() => () => abortRef.current?.abort(), [])

  const runEffect = useCallback(
    async (
      effect: Effect,
      sessionId: string | null,
      signal: AbortSignal,
    ): Promise<TurnAction | null> => {
      switch (effect.kind) {
        case 'createSession': {
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: config.mode, persona: config.persona, scenarioId: config.scenarioId }),
            signal,
          })
          if (!response.ok) throw new Error(`could not start a session (${response.status})`)
          const data = await response.json()
          return {
            type: 'SESSION_STARTED',
            sessionId: data.sessionId,
            hearts: data.hearts,
            greeting: data.greeting,
            now: Date.now(),
          }
        }

        case 'judge': {
          const response = await fetch('/api/judge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ learnerText: effect.learnerText }),
            signal,
          })
          // Fail open: a judge outage must not cost a heart. Deliberate, and stated here rather
          // than emerging from a bare catch the way v1's did (finding S12).
          const offContext = response.ok ? Boolean((await response.json()).offContext) : false
          return {
            type: 'JUDGE_VERDICT',
            offContext,
            icons: effect.icons,
            expression: effect.expression,
            now: Date.now(),
          }
        }

        case 'dialogue': {
          await streamDialogue(
            { icons: effect.icons, npcInitiated: effect.npcInitiated, expression: effect.expression },
            {
              onStart: () => dispatch({ type: 'STREAM_STARTED' }),
              onDelta: (text) => dispatch({ type: 'STREAM_DELTA', text }),
              onMetadata: (data) =>
                dispatch({
                  type: 'STREAM_METADATA',
                  turnIndex: data.turnIndex,
                  hearts: data.hearts,
                  npcEmotion: data.npcEmotion as TurnState['npcEmotion'],
                  sessionComplete: data.sessionComplete,
                  learnerText: data.learnerText,
                  activeEventLine: data.activeEventLine,
                }),
            },
            signal,
          )
          return { type: 'STREAM_FINISHED', now: Date.now() }
        }

        case 'logEvent': {
          if (!sessionId) return null
          await fetch(`/api/sessions/${sessionId}/events`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: effect.type, payload: effect.payload }),
            signal,
          })
          return null
        }

        case 'endSession': {
          if (!sessionId) return null
          await fetch(`/api/sessions/${sessionId}/end`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason: effect.reason }),
            signal,
          })
          return null
        }
      }
    },
    [config.mode, config.persona, config.scenarioId],
  )

  // The session id is passed into each effect rather than mirrored in a ref. Assigning a ref
  // during render is exactly what v1 did at session/page.tsx:270-276 and :511, and it is unsafe
  // under concurrent rendering: an abandoned render can leave the ref pointing at a value that
  // was never committed.
  const { sessionId } = state

  useEffect(() => {
    const pending = state.pending.filter((effect) => !startedEffects.current.has(effect.id))
    if (pending.length === 0) return

    for (const effect of pending) {
      startedEffects.current.add(effect.id)

      const controller = new AbortController()
      if (effect.kind === 'dialogue') abortRef.current = controller

      void runEffect(effect, sessionId, controller.signal)
        .then((action) => {
          if (action) dispatch(action)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          const kind = toTurnErrorKind(error)
          dispatch(
            effect.kind === 'createSession'
              ? { type: 'SESSION_FAILED', kind: kind ?? 'session_failed' }
              : { type: 'STREAM_FAILED', kind: kind ?? 'stream_failed', now: Date.now() },
          )
        })
        .finally(() => dispatch({ type: 'EFFECT_SETTLED', id: effect.id }))
    }
  }, [state.pending, sessionId, runEffect])

  return [state, dispatch] as const
}
