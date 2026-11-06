// The session transcript, from the event log.
//
// It renders the same ScoringTurn[] the scorer is given (lib/scoring/transcript.ts), which is the
// point: a reader checking the radar against the conversation is looking at exactly what produced
// it, icons included. v1's version mapped event types to chat roles with a binary else, so a
// heart_lost row became an assistant turn with empty content, and it discarded the icon array
// entirely — the therapist read fluent English the learner never produced.

import type { ScoringTurn } from '@/lib/scoring/transcript'

interface Props {
  readonly turns: readonly ScoringTurn[]
}

const bubble = (align: 'left' | 'right'): React.CSSProperties => ({
  maxWidth: '84%',
  alignSelf: align === 'left' ? 'flex-start' : 'flex-end',
  padding: '10px 14px',
  borderRadius: align === 'left' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
  background: align === 'left' ? 'var(--surface-sub)' : 'var(--nav-active-bg)',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.45,
})

export default function ReportTranscript({ turns }: Props) {
  if (turns.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
        This session has no turns.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {turns.map((turn, index) => {
        if (turn.role === 'note') {
          return (
            <p
              key={index}
              style={{
                margin: 0,
                alignSelf: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#c0394a',
              }}
            >
              heart lost &middot; {turn.reason.replace('_', ' ')}
            </p>
          )
        }

        if (turn.role === 'npc') {
          return (
            <div key={index} style={bubble('left')}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                Uncle &middot; {turn.npcEmotion}
              </span>
              {turn.content}
            </div>
          )
        }

        return (
          <div key={index} style={bubble('right')}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--nav-active-text)', marginBottom: 2 }}>
              Learner{turn.npcInitiated ? ' · prompted' : ''}
            </span>
            {turn.translated}
            {turn.icons.length > 0 ? (
              <span
                style={{
                  display: 'block',
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                {turn.icons.join(' + ')}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
