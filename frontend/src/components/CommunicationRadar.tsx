'use client'

import { useState } from 'react'

export interface CompetenceData {
  dimension: string
  value: number // 0–100 scale
}

interface Props {
  scores: CompetenceData[]
  size?: number
  /** When true, each dimension row is clickable and reveals a description panel */
  interactive?: boolean
}

export const DIMENSION_COLORS: Record<string, string> = {
  Operational: '#3B82F6',
  Linguistic:  '#34A853',
  Social:      '#F59E0B',
  Strategic:   '#EF4444',
  Confidence:  '#8B5CF6',
}

export const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  Operational:
    'Uses language for transactional tasks — ordering food, giving instructions, navigating services. Measured by task completion and functional vocabulary.',
  Linguistic:
    'Grammar, vocabulary range, and sentence structure accuracy in spontaneous speech. Higher scores reflect varied, accurate language use under natural conditions.',
  Social:
    'Turn-taking, politeness conventions, interaction management, and social awareness. Reflects how well the learner manages conversational flow and adapts to social cues.',
  Strategic:
    'Ability to repair misunderstandings, deploy compensatory strategies, and request clarification. This is often the primary area of focus for AAC learners.',
  Confidence:
    'Willingness to engage, assertiveness, and reduced hesitation. High confidence enables the learner to initiate and sustain communication even when uncertain.',
}

function polarPoint(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const angleDeg = 90 - (360 / n) * i
  const rad = (angleDeg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)]
}

function polygonPoints(cx: number, cy: number, r: number, n: number): string {
  return Array.from({ length: n }, (_, i) => polarPoint(cx, cy, r, i, n).join(',')).join(' ')
}

export function CommunicationRadar({ scores, size = 260, interactive = false }: Props) {
  const [activeDim, setActiveDim] = useState<string | null>(null)

  const n    = scores.length
  const cx   = size / 2
  const cy   = size / 2
  const maxR = size / 2 - 48
  const rings = [20, 40, 60, 80, 100]

  const dataPoints = scores.map((s, i) =>
    polarPoint(cx, cy, (s.value / 100) * maxR, i, n)
  )

  const labelPoints = scores.map((_, i) =>
    polarPoint(cx, cy, maxR + 22, i, n)
  )

  function anchor(x: number): 'start' | 'middle' | 'end' {
    if (x < cx - 4) return 'end'
    if (x > cx + 4) return 'start'
    return 'middle'
  }

  const dataPath =
    dataPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z'

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={polygonPoints(cx, cy, (ring / 100) * maxR, n)}
            fill="none"
            stroke="#EBEBEB"
            strokeWidth="1"
            strokeDasharray={ring < 100 ? '3 2' : '0'}
          />
        ))}

        {scores.map((_, i) => {
          const [x, y] = polarPoint(cx, cy, maxR, i, n)
          return (
            <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)}
              stroke="#EBEBEB" strokeWidth="1" />
          )
        })}

        <path d={dataPath} fill="rgba(125,178,246,.22)"
          stroke="#7DB2F6" strokeWidth="2" strokeLinejoin="round" />

        {dataPoints.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="5"
            fill={DIMENSION_COLORS[scores[i].dimension] ?? '#7DB2F6'}
            stroke="white" strokeWidth="2" />
        ))}

        {scores.map((s, i) => {
          const [lx, ly] = labelPoints[i]
          const color = DIMENSION_COLORS[s.dimension] ?? '#767676'
          return (
            <text key={i} x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor={anchor(lx)} dominantBaseline="middle"
              fill={color} fontSize="11" fontWeight="700"
              style={{ fontFamily: 'var(--font)' }}>
              {s.dimension}
            </text>
          )
        })}
      </svg>

      {/* Score legend rows — clickable when interactive=true */}
      <div className="flex flex-wrap justify-center gap-4 w-full">
        {scores.map((s) => {
          const color   = DIMENSION_COLORS[s.dimension] ?? '#767676'
          const isOpen  = activeDim === s.dimension
          const desc    = DIMENSION_DESCRIPTIONS[s.dimension]
          return (
            <div key={s.dimension} className="flex flex-col items-center gap-1">
              <button
                onClick={() => interactive && setActiveDim(isOpen ? null : s.dimension)}
                style={{
                  cursor:     interactive ? 'pointer' : 'default',
                  background: 'none',
                  border:     'none',
                  padding:    0,
                  fontFamily: 'var(--font)',
                }}
                aria-expanded={interactive ? isOpen : undefined}
                aria-label={interactive ? `${s.dimension} — click to learn more` : undefined}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {Math.round(s.value / 10)}
                  </span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center', display: 'block' }}>
                  {s.dimension}
                </span>
              </button>

              {/* Expanded description (interactive mode only) */}
              {interactive && isOpen && desc && (
                <div
                  style={{
                    background:   'var(--surface-sub)',
                    borderRadius: '12px',
                    padding:      '12px 14px',
                    fontSize:     '12px',
                    fontWeight:   500,
                    color:        'var(--text-secondary)',
                    lineHeight:   1.55,
                    maxWidth:     '280px',
                    marginTop:    '6px',
                    border:       '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    {s.dimension}
                  </span>
                  {desc}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
