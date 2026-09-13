// Literal unions replace v1's silent dict fallbacks.
//
// v1 did SCENARIO_PROMPTS.get(id, hawker_centre) at main.py:373 and
// PERSONA_PROMPTS.get(persona, zippy_sotong) at :381, so an unknown scenario id produced a
// Singapore hawker uncle in a school group project, and every learner whose stored persona was
// 'guided_learner' (the session-service default, index.js:151) was silently prompted as a Zippy
// Sotong with nothing logged. Findings 2.14 and S11.
//
// Here an unrecognised value cannot be constructed, and the zod schemas at the route boundary
// turn one into a 400.

export const SCENARIO_IDS = ['hawker_centre'] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const MODE_IDS = ['learning', 'survival'] as const
export type ModeId = (typeof MODE_IDS)[number]

// The five Singlish animals. 'guided_learner' from v1's dead vocabulary does not exist here.
export const PERSONA_IDS = [
  'zippy_sotong',
  'steady_turtle',
  'shy_chick',
  'garang_crab',
  'curious_monkey',
] as const
export type PersonaId = (typeof PERSONA_IDS)[number]

export const NPC_PERSONALITIES = ['Friendly', 'Impatient', 'Confused'] as const
export type NpcPersonality = (typeof NPC_PERSONALITIES)[number]

export const SUPPORT_LEVELS = ['High', 'Moderate', 'Low', 'Independent'] as const
export type SupportLevel = (typeof SUPPORT_LEVELS)[number]

export const NPC_EMOTIONS = ['happy', 'sad', 'mad', 'confused', 'surprised', 'neutral'] as const
export type NpcEmotion = (typeof NPC_EMOTIONS)[number]

/** main.py:273-276. Populated in Phase 3; the branch is ported now so the shape is settled. */
export interface EmotionContext {
  readonly summaryEmotion: string
  readonly explanation: string
  readonly avgScore: number
}

/** main.py:392-408. All five are 0-100, or null when the learner has no prior sessions. */
export interface CompetenceScores {
  readonly operational: number | null
  readonly linguistic: number | null
  readonly social: number | null
  readonly strategic: number | null
  readonly confidence: number | null
}

/**
 * Inputs to build_system_prompt (main.py:353-371), minus two fields.
 *
 * `custom_npc_prompt` is deliberately absent: at main.py:373 it replaced the entire scenario
 * prompt from an unauthenticated request body, and no code in v1 ever sent it. Finding S6 — a
 * live injection surface with no legitimate caller, so the fix is to delete the field.
 *
 * `hearts` is also absent because v1's prompt never saw it. Hearts live in the session row and
 * the UI only.
 */
export interface PromptInput {
  readonly scenarioId: ScenarioId
  readonly mode: ModeId
  readonly persona: PersonaId
  readonly npcPersonality?: NpcPersonality | null
  readonly supportLevel?: SupportLevel | null
  readonly competence?: CompetenceScores | null
  readonly emotion?: EmotionContext | null
  readonly moodModifier?: string | null
  readonly availableIcons?: readonly string[] | null
  readonly turnIndex?: number | null
  readonly npcInitiated?: boolean
  readonly activeEvent?: string | null
}
