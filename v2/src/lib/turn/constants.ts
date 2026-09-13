// Timing constants, from v1 session/page.tsx:21-24. None of them had a comment explaining the
// number (finding 2.12); the notes below are what the numbers are actually for, so the next
// person is not guessing.

/** Silence after which the NPC speaks unprompted. Shorter in survival: the NPC is impatient. */
export const BUMP_MS = {
  survival: 15_000,
  learning: 20_000,
} as const

/** Survival only. Silence past this costs a heart. Twice the survival bump, so the NPC always
 *  nudges once before the learner is penalised. */
export const SURVIVAL_TIMEOUT_MS = 30_000

export const MAX_HEARTS = 5

/** One clock for the whole page, replacing v1's three independent timers. */
export const TICK_MS = 1_000
