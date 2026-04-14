'use client'

export interface CompetenceData {
  dimension: string
  value: number // 0–100 scale
}

interface Props {
  scores: CompetenceData[]
  size?: number
}

export const DIMENSION_COLORS: Record<string, string> = {
  Operational: '#7ECFF5',
  Linguistic:  '#4ade80',
  Social:      '#FBBF24',
  Strategic:   '#F87171',
  Confidence:  '#C084FC',
}

function polarPoint(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const angleDeg = 90 - (360 / n) * i
  const rad = (angleDeg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)]
}

function polygonPoints(cx: number, cy: number, r: number, n: number): string {
  return Array.from({ length: n }, (_, i) => polarPoint(cx, cy, r, i, n).join(',')).join(' ')
}

export function CommunicationRadar({ scores, size = 260 }: Props) {
  const n   = scores.length
  const cx  = size / 2
  const cy  = size / 2
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
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray={ring < 100 ? '3 2' : '0'}
          />
        ))}

        {scores.map((_, i) => {
          const [x, y] = polarPoint(cx, cy, maxR, i, n)
          return (
            <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)}
              stroke="#e5e7eb" strokeWidth="1" />
          )
        })}

        <path d={dataPath} fill="#93C5FD" fillOpacity={0.25}
          stroke="#60A5FA" strokeWidth="2" strokeLinejoin="round" />

        {dataPoints.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="5"
            fill={DIMENSION_COLORS[scores[i].dimension] ?? '#60A5FA'}
            stroke="white" strokeWidth="2" />
        ))}

        {scores.map((s, i) => {
          const [lx, ly] = labelPoints[i]
          const color = DIMENSION_COLORS[s.dimension] ?? '#6b7280'
          return (
            <text key={i} x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor={anchor(lx)} dominantBaseline="middle"
              fill={color} fontSize="11" fontWeight="700">
              {s.dimension}
            </text>
          )
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-5">
        {scores.map((s) => {
          const color = DIMENSION_COLORS[s.dimension] ?? '#6b7280'
          return (
            <div key={s.dimension} className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-lg font-extrabold text-gray-900">{Math.round(s.value / 10)}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{s.dimension}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
