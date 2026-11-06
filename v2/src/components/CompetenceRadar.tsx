// The competence radar.
//
// Ported from v1's CommunicationRadar (frontend/src/components/CommunicationRadar.tsx), which was
// already dependency-free SVG; v1's Recharts dependency served its emotion bar chart, not this.
// v2 adds no charting library. The geometry lives in lib/report/radar.ts so it can be asserted on.
//
// One thing here is genuinely new. A dimension can be null — "not observed" — and it is drawn as
// an open spoke with no data point rather than as a point at the centre. The distinction is the
// whole reason the schema allows null: strategic competence needs an opportunity (a breakdown) to
// be visible at all, and a session where nothing went wrong is not evidence that the learner
// cannot repair. A spoke at zero would make exactly that claim, on a clinical chart, silently.

import { labelAnchor, polarPoint, polygonPoints, scorePath } from '@/lib/report/radar'
import { SCORE_DIMENSIONS, type CompetenceScoreResult } from '@/lib/scoring/schema'

interface Props {
  readonly scores: CompetenceScoreResult
  readonly size?: number
}

const LABELS: Record<(typeof SCORE_DIMENSIONS)[number], string> = {
  operational: 'Operational',
  linguistic: 'Linguistic',
  social: 'Social',
  strategic: 'Strategic',
  confidence: 'Confidence',
}

/** Carried over from v1 so the two versions' charts read the same way side by side. */
const COLOURS: Record<(typeof SCORE_DIMENSIONS)[number], string> = {
  operational: '#3B82F6',
  linguistic: '#34A853',
  social: '#F59E0B',
  strategic: '#EF4444',
  confidence: '#8B5CF6',
}

const RINGS = [20, 40, 60, 80, 100]

/** Horizontal room for the side labels, which sit outside the chart and read outward from it.
 *  Without it "Confidence" renders as "dence" — the viewBox clips what the anchor pushes left. */
const LABEL_GUTTER = 58
const LABEL_OFFSET = 22

export default function CompetenceRadar({ scores, size = 280 }: Props) {
  const sides = SCORE_DIMENSIONS.length
  const centre = size / 2
  const maxRadius = size / 2 - 40
  const values = SCORE_DIMENSIONS.map((key) => scores[key])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <svg
        width={size + LABEL_GUTTER * 2}
        height={size}
        style={{ maxWidth: '100%' }}
        viewBox={`${-LABEL_GUTTER} 0 ${size + LABEL_GUTTER * 2} ${size}`}
        role="img"
        aria-label={SCORE_DIMENSIONS.map(
          (key) => `${LABELS[key]} ${scores[key] === null ? 'not observed' : scores[key]}`,
        ).join(', ')}
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygonPoints(centre, centre, (ring / 100) * maxRadius, sides)}
            fill="none"
            stroke="#EBEBEB"
            strokeWidth="1"
            strokeDasharray={ring < 100 ? '3 2' : '0'}
          />
        ))}

        {SCORE_DIMENSIONS.map((key, i) => {
          const [x, y] = polarPoint(centre, centre, maxRadius, i, sides)
          const observed = scores[key] !== null
          return (
            <line
              key={key}
              x1={centre}
              y1={centre}
              x2={x.toFixed(1)}
              y2={y.toFixed(1)}
              stroke="#EBEBEB"
              strokeWidth="1"
              // An unobserved axis is dashed, so the gap in the shape is legibly a gap in the
              // evidence rather than a rendering accident.
              strokeDasharray={observed ? '0' : '2 4'}
            />
          )
        })}

        <path
          d={scorePath(values, centre, centre, maxRadius)}
          fill="rgba(125,178,246,.22)"
          stroke="#7DB2F6"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {SCORE_DIMENSIONS.map((key, i) => {
          const value = scores[key]
          if (value === null) return null
          const [x, y] = polarPoint(centre, centre, (value / 100) * maxRadius, i, sides)
          return (
            <circle
              key={key}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r="5"
              fill={COLOURS[key]}
              stroke="#fff"
              strokeWidth="2"
            />
          )
        })}

        {SCORE_DIMENSIONS.map((key, i) => {
          const [x, y] = polarPoint(centre, centre, maxRadius + LABEL_OFFSET, i, sides)
          const observed = scores[key] !== null
          return (
            <text
              key={key}
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              textAnchor={labelAnchor(x, centre)}
              dominantBaseline="middle"
              fill={observed ? COLOURS[key] : 'var(--text-muted)'}
              fontSize="11"
              fontWeight="700"
              style={{ fontFamily: 'var(--font)' }}
            >
              {LABELS[key]}
            </text>
          )
        })}
      </svg>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 18,
          width: '100%',
        }}
      >
        {SCORE_DIMENSIONS.map((key) => {
          const value = scores[key]
          return (
            <div
              key={key}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: value === null ? 'transparent' : COLOURS[key],
                    border: value === null ? '1.5px dashed var(--text-muted)' : 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: value === null ? 12 : 18,
                    fontWeight: 800,
                    color: value === null ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}
                >
                  {value === null ? 'not observed' : Math.round(value)}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {LABELS[key]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
