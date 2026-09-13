// The learner-side expression vocabulary.
//
// Phase 3 reconciles what BACKLOG.md recorded as three live emotion taxonomies. After this file
// there are two, and they describe different subjects:
//
//  - NPC_EMOTIONS (six, lib/prompt/types.ts) is how the character feels. Settled in Phase 2.
//  - LEARNER_EMOTIONS (twelve, below) is how the learner seems. Model-produced, never hand-derived.
//
// DeepFace's seven classes are retired with expression-service/. Nothing in v2 emits them.
//
// EXPRESSION_DESCRIPTORS is deliberately NOT a third emotion taxonomy. Those words name visible
// muscle activity, not feeling, and they are computed arithmetically from blendshapes. Calling an
// arithmetic result "angry" is what finding 2.9 punishes; calling it "tense" is a description of
// the face, and the interpretation is left to the model reading the prompt.

/** v1's /summarize-emotion vocabulary, dialogue-engine/main.py:832, now an enforced enum.
 *  v1 interpolated whatever string the model returned straight into the system prompt. */
export const LEARNER_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fear',
  'surprise',
  'disgust',
  'neutral',
  'frustrated',
  'confused',
  'content',
  'anxious',
  'excited',
] as const
export type LearnerEmotion = (typeof LEARNER_EMOTIONS)[number]

/** Reads as "the learner appears ___" in emotionPart. Observation, not diagnosis. */
export const EXPRESSION_DESCRIPTORS = [
  'relaxed',
  'tense',
  'focused',
  'startled',
  'downcast',
  'still',
  'animated',
  'unreadable',
] as const
export type ExpressionDescriptor = (typeof EXPRESSION_DESCRIPTORS)[number]

/**
 * The ten signals kept from the landmarker's 52 blendshapes, left/right pairs averaged.
 *
 * Ten numbers per second is the whole payload. The landmarker reads the <video> element directly,
 * so the frame is never even copied to a canvas, let alone encoded, uploaded or stored — which is
 * the architecture claim this phase exists to make true rather than merely assert. v1 drew every
 * frame into a canvas, encoded it as JPEG at quality 0.7, and POSTed it (useWebcam.ts:50-65).
 */
export const SIGNAL_KEYS = [
  'smile',
  'frown',
  'browDown',
  'browInnerUp',
  'eyeWide',
  'eyeSquint',
  'jawOpen',
  'mouthPress',
  'noseSneer',
  'cheekSquint',
] as const
export type SignalKey = (typeof SIGNAL_KEYS)[number]

export type Signals = Readonly<Record<SignalKey, number>>

export interface ExpressionSample {
  /** Milliseconds since the window opened, not a wall clock. */
  readonly at: number
  readonly signals: Signals
}

/**
 * What the NPC is told. Shaped to fill PromptInput.emotion, whose field names come from v1
 * (dialogue-engine/main.py:273-276) and whose prompt text is byte-pinned by parity.test.ts.
 */
export interface ExpressionSummary {
  readonly summaryEmotion: ExpressionDescriptor
  readonly explanation: string
  readonly avgScore: number
}
