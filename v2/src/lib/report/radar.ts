// Radar geometry, as pure functions.
//
// Ported from v1's CommunicationRadar (frontend/src/components/CommunicationRadar.tsx:46-56),
// which was already dependency-free SVG — v1 pulled in Recharts, but only for the emotion bar
// chart, so the radar itself carried no library and does not need one here either.
//
// It lives in lib/ rather than inside the component because v2 has no React test renderer, so
// geometry in a .tsx file is geometry nobody can assert on. The component is a thin shell over
// this.

export type Point = readonly [x: number, y: number]

/**
 * The i-th vertex of an n-sided polygon at radius r, starting at twelve o'clock and going
 * clockwise. SVG's y axis points down, hence the subtraction.
 */
export function polarPoint(
  cx: number,
  cy: number,
  r: number,
  index: number,
  sides: number,
): Point {
  const degrees = 90 - (360 / sides) * index
  const radians = (degrees * Math.PI) / 180
  return [cx + r * Math.cos(radians), cy - r * Math.sin(radians)]
}

export const polygonPoints = (cx: number, cy: number, r: number, sides: number): string =>
  Array.from({ length: sides }, (_, i) =>
    polarPoint(cx, cy, r, i, sides)
      .map((n) => n.toFixed(1))
      .join(','),
  ).join(' ')

/** Which side of the chart a label sits on, so it can be anchored away from the centre. */
export const labelAnchor = (x: number, cx: number): 'start' | 'middle' | 'end' => {
  if (x < cx - 4) return 'end'
  if (x > cx + 4) return 'start'
  return 'middle'
}

/**
 * The filled path through the scored dimensions.
 *
 * A not-observed dimension has no vertex: the path closes across the gap rather than dipping to
 * the centre, because a spoke at zero reads as "this learner cannot do this" and that is exactly
 * the claim the nullable dimension exists to avoid making. The axis is still drawn and labelled —
 * see the component — so the gap is visibly a gap rather than a missing axis.
 */
export function scorePath(
  values: readonly (number | null)[],
  cx: number,
  cy: number,
  maxRadius: number,
): string {
  const vertices = values.flatMap((value, index) =>
    value === null ? [] : [polarPoint(cx, cy, (value / 100) * maxRadius, index, values.length)],
  )
  if (vertices.length === 0) return ''

  return (
    vertices
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ') + ' Z'
  )
}
