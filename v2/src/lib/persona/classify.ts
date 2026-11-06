// Ported from v1 persona-engine/main.py:54-76, which was a whole FastAPI container for a
// five-branch if-ladder over three floats.
//
// Two findings addressed:
//
// 2.13 — `re_prompt_count` was hardcoded to 0 by its only caller (session/page.tsx:407), so
//   `rePrompts > 3` and `rePrompts <= 1` were dead and a five-branch classifier was really a
//   two-variable function of latency and icon count. It is computed for real here; see
//   countRePrompts below for the definition, which v1 never had.
//
// 2.14 — the label vocabulary is the five Singlish animals and nothing else. v1 also carried a
//   dead three-label vocabulary whose `guided_learner` was the session-service default
//   (index.js:151), a value persona-engine rejected with a 400 (main.py:114-122) and
//   dialogue-engine silently coerced to zippy_sotong (main.py:381). PersonaId cannot express it.
//
// The thresholds below have no data behind them and no comment in v1 justified 20000ms, 5000ms,
// 3 icons or 3 re-prompts. This is a heuristic, not a model. Kept as-is so the port is
// like-for-like; revisiting it needs evidence, which is a later phase.

import type { PersonaId } from '@/lib/prompt/types'

export interface SessionMetrics {
  readonly avgResponseLatencyMs: number
  readonly rePromptCount: number
  readonly avgIconsPerMessage: number
}

export interface PersonaClassification {
  readonly persona: PersonaId
  readonly reason: string
}

const HIGH_LATENCY_MS = 20_000
const FAST_LATENCY_MS = 5_000
const BRISK_LATENCY_MS = 10_000
const MODERATE_LATENCY_MS = 15_000
const MANY_RE_PROMPTS = 3
const FEW_RE_PROMPTS = 1
const SIMPLE_COMBO_ICONS = 2
const RICH_COMBO_ICONS = 3

/** The persona a session starts at, before it has produced any signal to classify on. */
export const DEFAULT_PERSONA: PersonaId = 'steady_turtle'

/** persona-engine/main.py:54-76. First match wins. */
export function classifyPersona(metrics: SessionMetrics): PersonaClassification {
  const { avgResponseLatencyMs: latency, rePromptCount: rePrompts, avgIconsPerMessage: icons } =
    metrics

  if (latency > HIGH_LATENCY_MS || rePrompts > MANY_RE_PROMPTS) {
    return {
      persona: 'shy_chick',
      reason: 'High latency or frequent re-prompts — needs confidence building',
    }
  }
  if (latency < FAST_LATENCY_MS && icons < SIMPLE_COMBO_ICONS) {
    return {
      persona: 'zippy_sotong',
      reason: 'Very fast but simple icon combos — needs structure',
    }
  }
  if (latency < BRISK_LATENCY_MS && rePrompts <= FEW_RE_PROMPTS && icons >= RICH_COMBO_ICONS) {
    return {
      persona: 'garang_crab',
      reason: 'Fast response, minimal re-prompts, rich icon combos',
    }
  }
  if (latency < MODERATE_LATENCY_MS && icons >= SIMPLE_COMBO_ICONS) {
    return {
      persona: 'curious_monkey',
      reason: 'Exploratory and flexible communication style',
    }
  }
  return { persona: 'steady_turtle', reason: 'Moderate pace and thoughtful engagement' }
}

/** persona-engine/main.py:126. A linear decay with no stated basis. Kept, labelled as such. */
export function personaConfidence(avgResponseLatencyMs: number): number {
  return Math.max(0, Math.min(1, 1 - avgResponseLatencyMs / 60_000))
}

const REPAIR_OVERLAP_RATIO = 0.5

/**
 * A re-prompt is a repair attempt: a learner turn that reuses at least half of the icons from the
 * turn immediately before it.
 *
 * v1 never defined the term, which is why its only caller could get away with sending 0. This
 * definition is deliberately NOT v1's `is_repair` flag (`npcEmotion === 'confused'`,
 * session/page.tsx:535), because finding 2.9 makes that flag near-constant-true until Phase 2
 * fixes the emotion classifier. Icon overlap is independent of that bug, computable from the
 * event log alone, and deterministic.
 *
 * Overlap is measured on distinct icons, so repeating one icon three times in a row does not
 * inflate the count.
 */
export function countRePrompts(turns: ReadonlyArray<readonly string[]>): number {
  let count = 0

  for (let i = 1; i < turns.length; i++) {
    const previous = new Set(turns[i - 1])
    const current = new Set(turns[i])
    if (current.size === 0 || previous.size === 0) continue

    const shared = [...current].filter((icon) => previous.has(icon)).length
    if (shared / current.size >= REPAIR_OVERLAP_RATIO) count++
  }

  return count
}
