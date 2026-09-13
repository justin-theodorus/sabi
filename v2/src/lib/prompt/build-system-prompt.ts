// Port of build_system_prompt, v1 dialogue-engine/main.py:353-484.
//
// v1 was 130 lines of sequential `if` statements appending to a list, so the composition order
// was emergent from statement order and no branch could be tested on its own. Here the order is
// data in one place and each branch is an independently testable pure function — which is the
// shape the Phase 2 golden tests need.

import {
  FAREWELL_MARKERS,
  MODE_PROMPTS,
  PERSONALITY_PROMPTS,
  PERSONA_PROMPTS,
  PROMPT_TAIL,
  SCENARIO_PROMPTS,
  SUPPORT_PROMPTS,
} from '@/lib/prompt/constants'
import type { PromptInput, ScenarioId } from '@/lib/prompt/types'

type PartFn = (input: PromptInput) => string | null

// main.py:373
const scenarioPart: PartFn = ({ scenarioId }) => SCENARIO_PROMPTS[scenarioId]

// main.py:374
const modePart: PartFn = ({ mode }) => MODE_PROMPTS[mode]

// main.py:378-383. Deliberate asymmetry, and v1's comment explains it: in Survival Mode the NPC
// is "blind" to the learner's persona for realism. Competence and emotion below are included in
// both modes — the NPC can see your face but not your file.
const personaPart: PartFn = ({ mode, persona }) =>
  mode === 'learning' ? `LEARNER PROFILE: ${PERSONA_PROMPTS[persona]}` : null

// main.py:386-387
const personalityPart: PartFn = ({ npcPersonality }) =>
  npcPersonality ? PERSONALITY_PROMPTS[npcPersonality] : null

// main.py:388-389
const supportPart: PartFn = ({ supportLevel }) =>
  supportLevel ? SUPPORT_PROMPTS[supportLevel] : null

// main.py:392-408. Five inner branches, each on `is not None` so a genuine 0 still renders.
const COMPETENCE_LABELS = [
  ['operational', 'Operational (device/symbol use)'],
  ['linguistic', 'Linguistic (vocabulary/grammar)'],
  ['social', 'Social (appropriateness/turn-taking)'],
  ['strategic', 'Strategic (repair/rephrasing)'],
  ['confidence', 'Confidence (fluency/initiative)'],
] as const

const competencePart: PartFn = ({ competence }) => {
  if (!competence) return null

  const lines = COMPETENCE_LABELS.flatMap(([key, label]) => {
    const score = competence[key]
    return score === null || score === undefined ? [] : [`  - ${label}: ${Math.round(score)}/100`]
  })
  if (lines.length === 0) return null

  return (
    'LEARNER COMPETENCY FROM PREVIOUS SESSIONS:\n' +
    lines.join('\n') +
    '\nUse this to calibrate difficulty and support level appropriately.'
  )
}

// main.py:411-417
const emotionPart: PartFn = ({ emotion }) =>
  emotion
    ? `OBSERVABLE EXPRESSION: You notice the learner appears ${emotion.summaryEmotion}. ` +
      `(${emotion.explanation}). ` +
      'React naturally to what you observe—if they seem angry/upset, adjust your tone accordingly. ' +
      'In Learning Mode: be more supportive and empathetic. In Survival Mode: you might get defensive, back down, or match their energy.'
    : null

// main.py:419-420
const moodPart: PartFn = ({ moodModifier }) =>
  moodModifier ? `STORY MODIFIER: ${moodModifier}` : null

// main.py:423-429
const iconsPart: PartFn = ({ availableIcons }) =>
  availableIcons && availableIcons.length > 0
    ? `AVAILABLE AAC ICONS: The learner can ONLY communicate using these icons: ${availableIcons.join(', ')}. ` +
      'When asking questions or prompting a response, only prompt for things expressible with these icons. ' +
      'Do NOT ask questions requiring concepts the learner cannot select.'
    : null

// main.py:432-442. Two tiers; turn_index <= 3 appends nothing.
const narrativePart: PartFn = ({ turnIndex }) => {
  if (turnIndex === null || turnIndex === undefined) return null
  if (turnIndex >= 7) {
    return (
      'NARRATIVE: This is an advanced turn. If the core task is logically complete ' +
      '(order placed, topic resolved), naturally wrap up — confirm completion, say farewell, ' +
      'conclude. Do not keep looping.'
    )
  }
  if (turnIndex >= 4) {
    return `NARRATIVE: Turn ${turnIndex}. Begin moving toward a natural conclusion if the core task is done.`
  }
  return null
}

// main.py:445-450
const initiativePart: PartFn = ({ npcInitiated }) =>
  npcInitiated
    ? 'NPC INITIATIVE: The learner has been silent and not responded. React naturally — show ' +
      'impatience, gently prompt them, or express frustration depending on your character and ' +
      'mode. Speak as if nudging them to respond. Do NOT wait for them.'
    : null

// main.py:453-457
const eventPart: PartFn = ({ activeEvent }) =>
  activeEvent
    ? `UNEXPECTED EVENT: ${activeEvent}. React briefly in ONE short sentence, then immediately ` +
      'ask the learner what they want. Do not describe actions. Do not narrate. Just speak out ' +
      'loud as you naturally would.'
    : null

// main.py:460-469
const tailPart: PartFn = () => PROMPT_TAIL

/** Composition order, matching v1's append order at main.py:376-469. */
const PARTS: readonly PartFn[] = [
  scenarioPart,
  modePart,
  personaPart,
  personalityPart,
  supportPart,
  competencePart,
  emotionPart,
  moodPart,
  iconsPart,
  narrativePart,
  initiativePart,
  eventPart,
  tailPart,
]

export function buildSystemPrompt(input: PromptInput): string {
  return PARTS.map((part) => part(input))
    .filter((text): text is string => Boolean(text))
    .join('\n\n')
}

/**
 * main.py:569-570. Kept as-is for Phase 1 so the port is like-for-like, plus a hard turn cap.
 *
 * Finding S11: v1 required a scenario-specific farewell substring, so a scenario id outside the
 * four-key dict got an empty marker list and could never complete — the session only ended on a
 * manual exit or on running out of hearts. The cap makes stranding impossible. Phase 4 replaces
 * this rule outright.
 */
const MIN_COMPLETE_TURN = 6
const MAX_TURN = 12

export function isSessionComplete(
  scenarioId: ScenarioId,
  reply: string,
  turnIndex: number,
): boolean {
  if (turnIndex >= MAX_TURN) return true
  if (turnIndex < MIN_COMPLETE_TURN) return false

  const lower = reply.toLowerCase()
  return FAREWELL_MARKERS[scenarioId].some((marker) => lower.includes(marker))
}
