// Parity against v1. The fixtures in __fixtures__/v1-prompts.json are real output from v1's
// Python build_system_prompt (dialogue-engine/main.py:353-484), extracted by the script beside
// them, which execs the constants and the function out of main.py without importing anthropic.
//
// Regenerate with:  python3 src/lib/prompt/__fixtures__/extract-v1-prompts.py
//
// This is the port's own regression net: it proves the TypeScript composes the same bytes the
// Python did, so a prompt regression here is a real difference and not a rewrite artefact.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildSystemPrompt } from '@/lib/prompt/build-system-prompt'
import type { PromptInput } from '@/lib/prompt/types'
import v1Prompts from '@/lib/prompt/__fixtures__/v1-prompts.json' with { type: 'json' }

const BASE = { scenarioId: 'hawker_centre', mode: 'learning', persona: 'steady_turtle' } as const
const NO_COMPETENCE = {
  operational: null, linguistic: null, social: null, strategic: null, confidence: null,
} as const

// Keys must match the `cases` dict in extract-v1-prompts.py.
const CASES: Record<keyof typeof v1Prompts, PromptInput> = {
  minimal_learning: { ...BASE },
  survival_no_persona: { ...BASE, mode: 'survival' },
  all_branches: {
    ...BASE,
    moodModifier: 'rainy day',
    emotion: { summaryEmotion: 'calm', explanation: 'steady', avgScore: 0.5 },
    competence: { operational: 50, linguistic: 60, social: 70, strategic: 80, confidence: 90 },
    npcPersonality: 'Confused',
    supportLevel: 'Moderate',
    availableIcons: ['rice'],
    turnIndex: 8,
    npcInitiated: true,
    activeEvent: 'no more chicken',
  },
  turn4: { ...BASE, turnIndex: 4 },
  competence_zero: { ...BASE, competence: { ...NO_COMPETENCE, operational: 0 } },
}

for (const [name, input] of Object.entries(CASES)) {
  test(`composes the same prompt as v1: ${name}`, () => {
    assert.equal(buildSystemPrompt(input), v1Prompts[name as keyof typeof v1Prompts])
  })
}
