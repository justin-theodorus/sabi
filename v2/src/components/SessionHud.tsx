'use client'

import { MAX_HEARTS, SURVIVAL_TIMEOUT_MS } from '@/lib/turn/constants'
import type { ModeId } from '@/lib/prompt/types'

interface Props {
  readonly mode: ModeId
  readonly hearts: number
  readonly turnIndex: number
  readonly secondsLeft: number
  readonly onEnd: () => void
}

const TOTAL_SECONDS = SURVIVAL_TIMEOUT_MS / 1000
const URGENT_SECONDS = 10

/** Hearts and the survival countdown. Both are survival-only, as in v1. */
export default function SessionHud({ mode, hearts, turnIndex, secondsLeft, onEnd }: Props) {
  const isSurvival = mode === 'survival'
  const urgent = isSurvival && secondsLeft <= URGENT_SECONDS

  return (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Hawker Centre</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          {mode} mode &middot; turn {turnIndex}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {isSurvival ? (
        <>
          <Countdown seconds={secondsLeft} urgent={urgent} />
          <Hearts remaining={hearts} />
        </>
      ) : null}

      <button
        onClick={onEnd}
        style={{
          flexShrink: 0,
          padding: '7px 13px',
          borderRadius: 'var(--radius-pill, 999px)',
          border: '1px solid var(--border)',
          background: 'var(--surface-sub)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        End
      </button>
    </header>
  )
}

function Hearts({ remaining }: { remaining: number }) {
  return (
    <div
      aria-label={`${remaining} of ${MAX_HEARTS} hearts remaining`}
      style={{ display: 'flex', gap: 3, flexShrink: 0 }}
    >
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            transform: 'rotate(-45deg)',
            background: i < remaining ? 'var(--pink)' : 'var(--surface-sub)',
            border: `1px solid ${i < remaining ? 'var(--pink)' : 'var(--border)'}`,
          }}
        />
      ))}
    </div>
  )
}

function Countdown({ seconds, urgent }: { seconds: number; urgent: boolean }) {
  const fraction = Math.max(0, Math.min(1, seconds / TOTAL_SECONDS))
  const colour = urgent ? 'var(--pink)' : 'var(--green)'

  return (
    <div
      aria-label={`${seconds} seconds to respond`}
      style={{
        flexShrink: 0,
        position: 'relative',
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: `conic-gradient(${colour} ${fraction * 360}deg, var(--surface-sub) 0deg)`,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--surface)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: urgent ? 'var(--pink)' : 'var(--text-secondary)',
        }}
      >
        {seconds}
      </span>
    </div>
  )
}
