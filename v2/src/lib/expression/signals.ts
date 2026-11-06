// 52 ARKit blendshapes -> the ten signals we keep.
//
// Pure, and deliberately separate from the landmarker so it can be tested without a browser, a
// camera or a 3.7MB model. The landmarker's own output is just an array of {categoryName, score}.

import { SIGNAL_KEYS, type SignalKey, type Signals } from '@/lib/expression/types'

/** Blendshape names contributing to each signal. Pairs are averaged, not summed, so every signal
 *  stays on the same 0-1 scale the landmarker reports. */
const SOURCES: Readonly<Record<SignalKey, readonly string[]>> = {
  smile: ['mouthSmileLeft', 'mouthSmileRight'],
  frown: ['mouthFrownLeft', 'mouthFrownRight'],
  browDown: ['browDownLeft', 'browDownRight'],
  browInnerUp: ['browInnerUp'],
  eyeWide: ['eyeWideLeft', 'eyeWideRight'],
  eyeSquint: ['eyeSquintLeft', 'eyeSquintRight'],
  jawOpen: ['jawOpen'],
  mouthPress: ['mouthPressLeft', 'mouthPressRight'],
  noseSneer: ['noseSneerLeft', 'noseSneerRight'],
  cheekSquint: ['cheekSquintLeft', 'cheekSquintRight'],
}

export interface BlendshapeCategory {
  readonly categoryName: string
  readonly score: number
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

export const ZERO_SIGNALS: Signals = Object.freeze(
  Object.fromEntries(SIGNAL_KEYS.map((key) => [key, 0])) as Record<SignalKey, number>,
)

/** A blendshape the model did not report counts as zero rather than as missing, so the signal
 *  vector is always the same fixed length and the wire schema can be exact. */
export function toSignals(categories: readonly BlendshapeCategory[]): Signals {
  const byName = new Map<string, number>()
  for (const category of categories) {
    if (Number.isFinite(category.score)) byName.set(category.categoryName, category.score)
  }

  const signals = {} as Record<SignalKey, number>
  for (const key of SIGNAL_KEYS) {
    const sources = SOURCES[key]
    let total = 0
    for (const name of sources) total += byName.get(name) ?? 0
    signals[key] = clamp01(total / sources.length)
  }
  return signals
}
