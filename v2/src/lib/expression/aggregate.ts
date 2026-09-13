// Turns a window of samples into the three fields PromptInput.emotion wants.
//
// This function is what replaces v1's second Claude call. v1 awaited POST /summarize-emotion
// before streamDialogue could begin, on every turn (frontend session/page.tsx:554-558), which put
// a full Haiku round trip in front of every time-to-first-token in the product. Phase 2 settled
// the precedent for that class of call with finding 2.9: ask the model in the call already
// happening. Here the split is sharper still — the NPC is handed the observation, arithmetic is
// enough to state it, and the only thing that needs a model is the label, which rides along in
// the dialogue call's structured output and never comes back into the prompt.
//
// What is kept from v1 is the idea the dossier singles out as the best in the repo: summarise the
// PROGRESSION, not a point sample. "What did their face do while composing this" beats "what is
// their face doing now", so the explanation below always reports a start and an end.

import {
  type ExpressionDescriptor,
  type ExpressionSample,
  type ExpressionSummary,
  type SignalKey,
  SIGNAL_KEYS,
} from '@/lib/expression/types'

/** Below this a signal is noise, not expression. The landmarker reports small non-zero scores for
 *  a resting face, so a floor is needed or every window reads as whatever drifts highest. */
const ACTIVITY_FLOOR = 0.15

/** How far the top signal must lead the runner-up to be called the dominant one. */
const SEPARATION = 0.08

/** Fraction of the expected 1-per-second samples that must carry a face for the window to mean
 *  anything. Below it the learner was looking away for most of the turn. */
const COVERAGE_FLOOR = 0.5

const SAMPLE_INTERVAL_MS = 1_000

/** How many signals the explanation names. Three keeps the prompt addition to roughly 20 tokens. */
const NAMED_SIGNALS = 3

const DESCRIPTOR_FOR: Readonly<Record<SignalKey, ExpressionDescriptor>> = {
  smile: 'relaxed',
  cheekSquint: 'relaxed',
  frown: 'downcast',
  browInnerUp: 'downcast',
  browDown: 'tense',
  mouthPress: 'tense',
  noseSneer: 'tense',
  eyeSquint: 'focused',
  eyeWide: 'startled',
  jawOpen: 'startled',
}

/** Plain-English names, because the NPC prompt is read by a model, not by a debugger. */
const LABEL_FOR: Readonly<Record<SignalKey, string>> = {
  smile: 'smile',
  frown: 'mouth turned down',
  browDown: 'brow tension',
  browInnerUp: 'inner brow raised',
  eyeWide: 'eyes wide',
  eyeSquint: 'eyes narrowed',
  jawOpen: 'jaw open',
  mouthPress: 'lips pressed',
  noseSneer: 'nose wrinkled',
  cheekSquint: 'cheeks raised',
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

const meanOf = (samples: readonly ExpressionSample[], key: SignalKey): number =>
  mean(samples.map((sample) => sample.signals[key]))

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Leading and trailing third, so a window that starts calm and ends tense reads as such. Below
 *  three samples there is no arc to report and both ends are the whole window. */
function ends(samples: readonly ExpressionSample[]): {
  readonly head: readonly ExpressionSample[]
  readonly tail: readonly ExpressionSample[]
} {
  if (samples.length < 3) return { head: samples, tail: samples }
  const third = Math.floor(samples.length / 3)
  return { head: samples.slice(0, third), tail: samples.slice(-third) }
}

/** Samples spanning N seconds should number about N+1. Far fewer means the face kept leaving. */
function coverage(samples: readonly ExpressionSample[]): number {
  const span = samples[samples.length - 1].at - samples[0].at
  const expected = Math.round(span / SAMPLE_INTERVAL_MS) + 1
  return expected <= 1 ? 1 : Math.min(samples.length / expected, 1)
}

function rank(samples: readonly ExpressionSample[]): readonly { key: SignalKey; value: number }[] {
  return SIGNAL_KEYS.map((key) => ({ key, value: meanOf(samples, key) })).sort(
    (a, b) => b.value - a.value,
  )
}

function describe(samples: readonly ExpressionSample[]): {
  readonly descriptor: ExpressionDescriptor
  readonly avgScore: number
} {
  if (coverage(samples) < COVERAGE_FLOOR) return { descriptor: 'unreadable', avgScore: 0 }

  const ranked = rank(samples)
  const [top, runnerUp] = ranked

  if (top.value < ACTIVITY_FLOOR) return { descriptor: 'still', avgScore: round2(top.value) }
  if (top.value - runnerUp.value < SEPARATION) {
    return { descriptor: 'animated', avgScore: round2(top.value) }
  }
  return { descriptor: DESCRIPTOR_FOR[top.key], avgScore: round2(top.value) }
}

/** "smile 0.44 -> 0.04, brow tension 0.21 -> 0.68, over 14s across 13 samples" */
function explain(samples: readonly ExpressionSample[]): string {
  const { head, tail } = ends(samples)
  const moved = SIGNAL_KEYS.map((key) => ({
    key,
    from: meanOf(head, key),
    to: meanOf(tail, key),
  }))
    .filter((signal) => Math.max(signal.from, signal.to) >= ACTIVITY_FLOOR)
    .sort((a, b) => Math.max(b.from, b.to) - Math.max(a.from, a.to))
    .slice(0, NAMED_SIGNALS)

  const seconds = Math.max(
    Math.round((samples[samples.length - 1].at - samples[0].at) / SAMPLE_INTERVAL_MS),
    1,
  )
  const span = `over ${seconds}s across ${samples.length} sample${samples.length === 1 ? '' : 's'}`

  if (moved.length === 0) return `no marked expression, ${span}`
  const parts = moved.map((s) => `${LABEL_FOR[s.key]} ${round2(s.from)} -> ${round2(s.to)}`)
  return `${parts.join(', ')}, ${span}`
}

/**
 * Null when there is nothing to say — no camera, no permission, or no face all turn. The prompt is
 * then byte-identical to a session with the feature switched off, because emotionPart returns null
 * for a null emotion. Degradation is the default path rather than an error path.
 */
export function summarizeExpression(
  samples: readonly ExpressionSample[],
): ExpressionSummary | null {
  if (samples.length === 0) return null

  const { descriptor, avgScore } = describe(samples)
  return { summaryEmotion: descriptor, explanation: explain(samples), avgScore }
}
