'use client'

import type { AACIcon } from '@/components/AACBoard'

interface Props {
  readonly selected: readonly AACIcon[]
  readonly disabled: boolean
  readonly onRemove: (index: number) => void
  readonly onClear: () => void
  readonly onSubmit: () => void
}

/**
 * The sentence the learner is composing, plus send and clear.
 *
 * The board reports taps and this owns the sentence, matching v1's split. Removing by index
 * rather than by id matters: the board is append-only and allows duplicates, so tapping "rice"
 * twice must produce two removable chips.
 */
export default function SentenceBar({ selected, disabled, onRemove, onClear, onSubmit }: Props) {
  const empty = selected.length === 0

  return (
    <section
      aria-label="Your message"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 62,
        padding: '9px 14px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto', minWidth: 0 }}>
        {empty ? (
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Tap icons to build a message
          </span>
        ) : (
          selected.map((icon, index) => (
            <button
              key={`${icon.id}-${index}`}
              onClick={() => onRemove(index)}
              disabled={disabled}
              aria-label={`Remove ${icon.label}`}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill, 999px)',
                background: 'var(--surface-sub)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              {icon.label}
            </button>
          ))
        )}
      </div>

      <button
        onClick={onClear}
        disabled={empty || disabled}
        style={pill(empty || disabled, 'var(--surface-sub)', 'var(--text-secondary)')}
      >
        Clear
      </button>

      <button
        onClick={onSubmit}
        disabled={empty || disabled}
        style={pill(empty || disabled, 'var(--green)', '#fff')}
      >
        Send
      </button>
    </section>
  )
}

const pill = (disabled: boolean, background: string, color: string): React.CSSProperties => ({
  flexShrink: 0,
  padding: '9px 16px',
  borderRadius: 'var(--radius-pill, 999px)',
  border: '1px solid var(--border)',
  background,
  color,
  fontFamily: 'var(--font)',
  fontSize: 13,
  fontWeight: 800,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.4 : 1,
})
