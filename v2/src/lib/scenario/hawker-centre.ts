// Scenario config, from v1 frontend/src/lib/scenarios.ts:32-72.
//
// Only hawker_centre ships. Finding 2.11: it is the only scenario with a background and NPC
// sprites; the other three render a black rectangle and a grey blob. Single scenario done
// properly is the stronger showcase, so this is a scope decision, not a gap.
//
// v1 carried this model through sessionStorage under three keys written by two different pages,
// one of which wrote only two of them (finding 3.2), so picking a scenario from the Practice hub
// silently loaded the previous one. Here it is a module constant on the server and there is
// nothing to desynchronise.

import type { ScenarioId } from '@/lib/prompt/types'

export interface ScenarioIcon {
  readonly id: string
  readonly label: string
}

export interface ScenarioEvent {
  readonly id: string
  /** Shown to the learner verbatim when the event fires. */
  readonly npcLine: string
  /** Passed to the prompt as `activeEvent`. */
  readonly context: string
}

export interface ScenarioConfig {
  readonly id: ScenarioId
  readonly title: string
  readonly description: string
  readonly background: string
  readonly npcName: string
  readonly npcGreeting: string
  readonly npcSpritePath: string
  readonly scenarioIcons: readonly ScenarioIcon[]
  readonly events: readonly ScenarioEvent[]
}

export const HAWKER_CENTRE: ScenarioConfig = {
  id: 'hawker_centre',
  title: 'Hawker Centre',
  description: 'Order food at a local hawker stall',
  background: '/backgrounds/hawker-centre.jpg',
  npcName: 'Uncle Beng',
  npcGreeting: 'Hello! Welcome to my stall. What would you like today?',
  npcSpritePath: '/npc/uncle',
  scenarioIcons: [
    { id: 'chicken-rice', label: 'chicken rice' },
    { id: 'chicken', label: 'chicken' },
    { id: 'rice', label: 'rice' },
    { id: 'noodle', label: 'noodle' },
    { id: 'wonton', label: 'wonton' },
    { id: 'drink', label: 'drink' },
    { id: 'water', label: 'water' },
    { id: 'tea', label: 'tea' },
    { id: 'food', label: 'food' },
    { id: 'eat', label: 'eat' },
    { id: 'hot', label: 'hot' },
    { id: 'cold', label: 'cold' },
    { id: 'spicy', label: 'spicy' },
    { id: 'one', label: 'one' },
    { id: 'two', label: 'two' },
    { id: 'how-much', label: 'how much' },
    { id: 'takeaway', label: 'takeaway' },
  ],
  events: [
    {
      id: 'queue_cutter',
      npcLine: 'Another customer pushes in and shouts their order.',
      context:
        'A rude customer just jumped the queue and is trying to order ahead of the learner. ' +
        'The uncle looks flustered. The learner may want to speak up or wait.',
    },
    {
      id: 'ingredient_shortage',
      npcLine: 'Aiyah, sorry ah — today no more chicken already!',
      context:
        'The uncle just announced they have run out of chicken. ' +
        'The learner needs to choose an alternative dish.',
    },
  ],
}

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  hawker_centre: HAWKER_CENTRE,
}

/**
 * The icon vocabulary the prompt is told the learner can use.
 *
 * Scenario icons only. The 128-icon core board is deliberately not listed: it would add roughly
 * 700 characters to every system prompt to tell the model something it can infer, and finding S5
 * is about prompt size. v1 sent exactly this list too (session/page.tsx:458-461).
 */
export const availableIconLabels = (scenario: ScenarioConfig): readonly string[] =>
  scenario.scenarioIcons.map((icon) => icon.label)

const EVENT_TURN_MIN = 2
const EVENT_TURN_MAX = 4

/**
 * Picks which turn the unexpected event fires on, and which event it is.
 *
 * Rolled server-side at session creation and stored on the row. v1 rolled it in the browser
 * (session/page.tsx:316-325), so it was neither reproducible nor visible in the therapist-facing
 * log, and the two code paths that consumed it disagreed about the window: the submit path
 * bounded it to two turns (:540) and the bump path did not (:475), so every bump after the
 * trigger turn re-fired the same event.
 */
export function rollScenarioEvent(
  scenario: ScenarioConfig,
  random: () => number = Math.random,
): { eventId: string | null; eventTriggerTurn: number } {
  if (scenario.events.length === 0) return { eventId: null, eventTriggerTurn: 0 }

  const event = scenario.events[Math.floor(random() * scenario.events.length)]
  const span = EVENT_TURN_MAX - EVENT_TURN_MIN + 1
  return {
    eventId: event.id,
    eventTriggerTurn: EVENT_TURN_MIN + Math.floor(random() * span),
  }
}

/** The event is live for the trigger turn and the one after it, on every path. */
export const EVENT_WINDOW_TURNS = 2

export function activeEventFor(
  scenario: ScenarioConfig,
  eventId: string | null,
  eventTriggerTurn: number | null,
  turnIndex: number,
): ScenarioEvent | null {
  if (!eventId || eventTriggerTurn === null || eventTriggerTurn <= 0) return null
  if (turnIndex < eventTriggerTurn) return null
  if (turnIndex >= eventTriggerTurn + EVENT_WINDOW_TURNS) return null

  return scenario.events.find((event) => event.id === eventId) ?? null
}
