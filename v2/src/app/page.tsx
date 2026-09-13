'use client'

import { useEffect, useState } from 'react'

import AACBoard from '@/components/AACBoard'
import ScenarioStage from '@/components/ScenarioStage'
import SentenceBar from '@/components/SentenceBar'
import SessionHud from '@/components/SessionHud'
import { DEFAULT_PERSONA } from '@/lib/persona/classify'
import type { ModeId } from '@/lib/prompt/types'
import { HAWKER_CENTRE } from '@/lib/scenario/hawker-centre'
import { secondsLeft as computeSecondsLeft } from '@/lib/turn/reducer'
import { useTurn } from '@/lib/turn/use-turn'

const COUNTDOWN_REFRESH_MS = 250

export default function Page() {
  const [mode, setMode] = useState<ModeId>('learning')
  const [state, dispatch] = useTurn({
    scenarioId: 'hawker_centre',
    mode,
    persona: DEFAULT_PERSONA,
  })

  // The countdown is derived from lastActivityAt rather than stored, so it needs a render to tick
  // down. v1 kept a second, independent countdown interval, which meant the ring the learner
  // watched and the timer that actually took the heart were only coincidentally aligned.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  if (state.phase === 'lobby') {
    return (
      <Lobby
        mode={mode}
        onMode={setMode}
        error={state.error?.message ?? null}
        onStart={() => dispatch({ type: 'START_REQUESTED', now: Date.now() })}
      />
    )
  }

  if (state.phase === 'over') {
    return <Summary hearts={state.hearts} turnIndex={state.turnIndex} endReason={state.endReason} />
  }

  const busy = state.phase !== 'idle'
  const lastNpcLine = [...state.transcript].reverse().find((turn) => turn.role === 'npc')?.text ?? ''

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <SessionHud
        mode={state.config.mode}
        hearts={state.hearts}
        turnIndex={state.turnIndex}
        secondsLeft={computeSecondsLeft(state, now)}
        onEnd={() => dispatch({ type: 'END_REQUESTED', reason: 'manual' })}
      />

      <ScenarioStage
        scenario={HAWKER_CENTRE}
        npcEmotion={state.npcEmotion}
        reply={state.streamingText || lastNpcLine}
        isStreaming={busy}
        eventLine={state.activeEventLine}
      />

      {state.error ? (
        <div
          role="alert"
          style={{
            flexShrink: 0,
            padding: '9px 14px',
            background: 'var(--pink)',
            color: '#5c1622',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          That turn did not go through — try again. ({state.error.message})
        </div>
      ) : null}

      <SentenceBar
        selected={state.selected}
        disabled={busy}
        onRemove={(index) => dispatch({ type: 'ICON_REMOVED', index })}
        onClear={() => dispatch({ type: 'SELECTION_CLEARED' })}
        onSubmit={() => dispatch({ type: 'SUBMIT_REQUESTED', now: Date.now() })}
      />

      <div style={{ flex: '0 0 46%', minHeight: 0 }}>
        <AACBoard
          onIconSelect={(icon) => dispatch({ type: 'ICON_SELECTED', icon })}
          selectedIds={state.selected.map((icon) => icon.id)}
          scenarioIcons={HAWKER_CENTRE.scenarioIcons.map(({ id, label }) => ({ id, label }))}
        />
      </div>
    </main>
  )
}

const screenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 16,
  minHeight: '100dvh',
  maxWidth: 460,
  margin: '0 auto',
  padding: '24px 16px',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '15px 18px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--green)',
  color: '#fff',
  fontFamily: 'var(--font)',
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
}

function Lobby({
  mode,
  onMode,
  onStart,
  error,
}: {
  mode: ModeId
  onMode: (mode: ModeId) => void
  onStart: () => void
  error: string | null
}) {
  return (
    <main style={screenStyle}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.4px' }}>SABI</h1>
        <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Practise ordering at a hawker centre using an AAC board. No sign-in.
        </p>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.4px',
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Mode
        </legend>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['learning', 'survival'] as const).map((option) => (
            <button
              key={option}
              onClick={() => onMode(option)}
              aria-pressed={mode === option}
              style={{
                flex: 1,
                padding: '13px 12px',
                borderRadius: 12,
                border: `2px solid ${mode === option ? 'var(--green)' : 'var(--border)'}`,
                background: mode === option ? 'var(--green)' : 'var(--surface)',
                color: mode === option ? '#fff' : 'var(--text-primary)',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: 700,
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {option}
            </button>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {mode === 'learning'
            ? 'The uncle is patient and helps you along.'
            : 'The uncle behaves like a real person at lunch rush. Five hearts, thirty seconds a turn.'}
        </p>
      </fieldset>

      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#c0394a' }}>
          {error}
        </p>
      ) : null}

      <button onClick={onStart} style={primaryButtonStyle}>
        Start
      </button>
    </main>
  )
}

function Summary({
  hearts,
  turnIndex,
  endReason,
}: {
  hearts: number
  turnIndex: number
  endReason: string | null
}) {
  const headline =
    endReason === 'hearts_exhausted'
      ? 'Out of hearts'
      : endReason === 'farewell'
        ? 'Order complete'
        : 'Session ended'

  return (
    <main style={{ ...screenStyle, textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{headline}</h1>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {turnIndex} {turnIndex === 1 ? 'turn' : 'turns'} &middot; {hearts} hearts left
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
        The session report arrives in a later phase.
      </p>
      <button onClick={() => window.location.reload()} style={primaryButtonStyle}>
        Start again
      </button>
    </main>
  )
}
