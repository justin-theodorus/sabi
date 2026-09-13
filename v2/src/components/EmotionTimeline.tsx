// The learner's face over the course of the session, one reading per turn.
//
// Deliberately not v1's chart. That one counted 1fps DeepFace rows into shares of the whole
// session — "neutral 62%, happy 21%" — and drew them as horizontal bars
// (therapist/sessions/[sessionId]/page.tsx:98-140). It stored a per-row offset and never used it,
// so it could say what the learner mostly looked like and never when they were struggling, which
// is the only part a therapist can act on.
//
// This reads left to right along the session's own clock. Each turn shows the descriptor computed
// from the blendshapes, the label the model gave the same window, and — on the same row — what the
// NPC was feeling, so a `confused` uncle sits directly above the face that met it.

import type { EmotionTimeline as Timeline } from '@/lib/report/timeline'

interface Props {
  readonly timeline: Timeline
}

/** Warm for engaged, cool for withdrawn, grey where the face said little. */
const DESCRIPTOR_COLOUR: Record<string, string> = {
  relaxed: '#34A853',
  animated: '#F59E0B',
  focused: '#3B82F6',
  tense: '#EF4444',
  startled: '#8B5CF6',
  downcast: '#6366F1',
  still: '#94A3B8',
  unreadable: '#CBD5E1',
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}s`

export default function EmotionTimeline({ timeline }: Props) {
  if (timeline.points.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
        No camera readings for this session. The learner may not have granted camera access, or no
        face was visible. Nothing is inferred from an absent reading.
      </p>
    )
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        Face visible for {timeline.points.length} of {timeline.npcTurns} turns, from{' '}
        {timeline.totalSamples} readings taken at one per second. Expression is measured in the
        browser and summarised per turn; no video or image ever left the device.
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {timeline.points.map((point) => {
          const colour = DESCRIPTOR_COLOUR[point.summaryEmotion] ?? 'var(--text-muted)'
          return (
            <li
              key={`${point.turnIndex}-${point.atMs}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 14,
                background: 'var(--surface-sub)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: colour,
                  flexShrink: 0,
                  // Intensity, not confidence: how strongly the strongest signal fired.
                  opacity: 0.35 + Math.min(point.avgScore, 1) * 0.65,
                }}
              />

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    appears {point.summaryEmotion}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {point.learnerEmotion === null ? 'unlabelled' : point.learnerEmotion}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                    turn {point.turnIndex + 1} &middot; {seconds(point.atMs)}
                    {point.npcInitiated ? ' · during silence' : ''}
                  </span>
                </div>

                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                  }}
                >
                  {point.explanation}
                </p>
              </div>

              <span
                className="badge badge-neutral"
                title="What the NPC was feeling on this turn"
                style={{ flexShrink: 0 }}
              >
                uncle {point.npcEmotion}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
