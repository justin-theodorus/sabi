import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildSystemPrompt, isSessionComplete } from '@/lib/prompt/build-system-prompt'
import { MODE_PROMPTS, PERSONA_PROMPTS, PROMPT_TAIL, SCENARIO_PROMPTS } from '@/lib/prompt/constants'
import type { PromptInput } from '@/lib/prompt/types'

const BASE: PromptInput = {
  scenarioId: 'hawker_centre',
  mode: 'learning',
  persona: 'steady_turtle',
}

const build = (overrides: Partial<PromptInput> = {}): string =>
  buildSystemPrompt({ ...BASE, ...overrides })

const sections = (prompt: string): string[] => prompt.split('\n\n')

// ── Unconditional parts ──────────────────────────────────────────────────────

test('always opens with the scenario prompt and closes with the tail', () => {
  const parts = sections(build())
  assert.equal(parts.at(0), SCENARIO_PROMPTS.hawker_centre)
  assert.equal(parts.at(-1), PROMPT_TAIL)
})

test('places the mode prompt immediately after the scenario', () => {
  assert.equal(sections(build())[1], MODE_PROMPTS.learning)
})

test('a minimal learning prompt is scenario, mode, persona, tail', () => {
  assert.equal(sections(build()).length, 4)
})

// ── Branch: persona, keyed off mode (main.py:380-383) ────────────────────────

test('includes the learner persona in learning mode', () => {
  assert.ok(build().includes(`LEARNER PROFILE: ${PERSONA_PROMPTS.steady_turtle}`))
})

test('withholds the learner persona in survival mode', () => {
  const prompt = build({ mode: 'survival' })
  assert.ok(!prompt.includes('LEARNER PROFILE:'))
  assert.ok(prompt.includes(MODE_PROMPTS.survival))
})

// ── Branch: npc personality and support level ────────────────────────────────

test('includes the npc personality when set', () => {
  assert.ok(build({ npcPersonality: 'Impatient' }).includes('You are in a hurry.'))
})

test('omits the npc personality when null', () => {
  assert.ok(!build({ npcPersonality: null }).includes('You are in a hurry.'))
})

test('includes the support level when set', () => {
  assert.ok(build({ supportLevel: 'High' }).includes('Use very simple, short sentences.'))
})

// ── Branch: competence, five inner sub-branches (main.py:392-408) ────────────

test('renders only the competence dimensions that are present', () => {
  const prompt = build({
    competence: { operational: 72, linguistic: null, social: null, strategic: null, confidence: null },
  })
  assert.ok(prompt.includes('LEARNER COMPETENCY FROM PREVIOUS SESSIONS:'))
  assert.ok(prompt.includes('  - Operational (device/symbol use): 72/100'))
  assert.ok(!prompt.includes('Linguistic'))
})

test('renders a zero score rather than treating it as absent', () => {
  const prompt = build({
    competence: { operational: 0, linguistic: null, social: null, strategic: null, confidence: null },
  })
  assert.ok(prompt.includes('  - Operational (device/symbol use): 0/100'))
})

test('rounds fractional competence scores', () => {
  const prompt = build({
    competence: { operational: 66.6, linguistic: null, social: null, strategic: null, confidence: null },
  })
  assert.ok(prompt.includes(': 67/100'))
})

test('omits the competence block entirely when every dimension is null', () => {
  const prompt = build({
    competence: { operational: null, linguistic: null, social: null, strategic: null, confidence: null },
  })
  assert.ok(!prompt.includes('LEARNER COMPETENCY'))
})

// ── Branch: emotion, mood, icons ─────────────────────────────────────────────

test('includes observed emotion as behaviour, not as a data field', () => {
  const prompt = build({
    emotion: { summaryEmotion: 'frustrated', explanation: 'brow furrowed throughout', avgScore: 0.7 },
  })
  assert.ok(prompt.includes('OBSERVABLE EXPRESSION: You notice the learner appears frustrated.'))
  assert.ok(prompt.includes('(brow furrowed throughout).'))
})

test('includes the mood modifier when set', () => {
  assert.ok(build({ moodModifier: 'the learner woke up grumpy' })
    .includes('STORY MODIFIER: the learner woke up grumpy'))
})

test('lists the available icons and constrains the question to them', () => {
  const prompt = build({ availableIcons: ['chicken rice', 'drink'] })
  assert.ok(prompt.includes('these icons: chicken rice, drink.'))
})

test('omits the icon block for an empty icon list', () => {
  assert.ok(!build({ availableIcons: [] }).includes('AVAILABLE AAC ICONS'))
})

// ── Branch: narrative phase, two tiers (main.py:432-442) ─────────────────────

test('adds no narrative nudge before turn 4', () => {
  assert.ok(!build({ turnIndex: 3 }).includes('NARRATIVE:'))
})

test('adds the wrap-up nudge at turn 4', () => {
  assert.ok(build({ turnIndex: 4 }).includes('NARRATIVE: Turn 4. Begin moving toward'))
})

test('escalates to the advanced-turn nudge at turn 7', () => {
  const prompt = build({ turnIndex: 7 })
  assert.ok(prompt.includes('NARRATIVE: This is an advanced turn.'))
  assert.ok(!prompt.includes('Begin moving toward'))
})

test('turn 0 passes the null guard but fires neither tier', () => {
  assert.ok(!build({ turnIndex: 0 }).includes('NARRATIVE:'))
})

// ── Branch: npc initiative and active event ──────────────────────────────────

test('includes the initiative block when the npc speaks into silence', () => {
  assert.ok(build({ npcInitiated: true }).includes('NPC INITIATIVE: The learner has been silent'))
})

test('includes the active event when one has fired', () => {
  assert.ok(build({ activeEvent: 'A rude customer just jumped the queue.' })
    .includes('UNEXPECTED EVENT: A rude customer just jumped the queue.'))
})

// ── Composition ──────────────────────────────────────────────────────────────

test('composes every branch in the documented order', () => {
  const prompt = build({
    mode: 'learning',
    npcPersonality: 'Confused',
    supportLevel: 'Moderate',
    competence: { operational: 50, linguistic: 60, social: 70, strategic: 80, confidence: 90 },
    emotion: { summaryEmotion: 'calm', explanation: 'steady', avgScore: 0.5 },
    moodModifier: 'rainy day',
    availableIcons: ['rice'],
    turnIndex: 8,
    npcInitiated: true,
    activeEvent: 'no more chicken',
  })

  const markers = [
    'You are a realistic hawker stall uncle',
    '### LEARNING MODE',
    'LEARNER PROFILE:',
    'You occasionally misunderstand the learner.',
    'Use moderately paced conversation',
    'LEARNER COMPETENCY FROM PREVIOUS SESSIONS:',
    'OBSERVABLE EXPRESSION:',
    'STORY MODIFIER:',
    'AVAILABLE AAC ICONS:',
    'NARRATIVE: This is an advanced turn.',
    'NPC INITIATIVE:',
    'UNEXPECTED EVENT:',
    'COMMUNICATION STYLE:',
  ]

  const positions = markers.map((m) => prompt.indexOf(m))
  assert.ok(positions.every((p) => p !== -1), 'every branch should be present')
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'branches should be in order')
  assert.equal(sections(prompt).length, markers.length)
})

test('separates every section with a blank line and never leaves an empty one', () => {
  const parts = sections(build({ turnIndex: 5, moodModifier: 'x' }))
  assert.ok(parts.every((p) => p.trim().length > 0))
})

// ── isSessionComplete (main.py:569-570 plus the S11 turn cap) ────────────────

test('does not complete before turn 6 even with a farewell marker', () => {
  assert.equal(isSessionComplete('hawker_centre', 'Here you go!', 5), false)
})

test('completes at turn 6 when the reply carries a farewell marker', () => {
  assert.equal(isSessionComplete('hawker_centre', 'Here you go, come again!', 6), true)
})

test('does not complete at turn 6 without a farewell marker', () => {
  assert.equal(isSessionComplete('hawker_centre', 'What else you want?', 6), false)
})

test('matches farewell markers case-insensitively', () => {
  assert.equal(isSessionComplete('hawker_centre', 'TAKE CARE ah', 7), true)
})

test('completes at the turn cap regardless of the reply, so a session cannot strand', () => {
  assert.equal(isSessionComplete('hawker_centre', 'What else you want?', 12), true)
})
