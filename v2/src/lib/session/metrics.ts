// Persona metrics, derived from the event log.
//
// Extracted from the end route in Phase 5. It was an unexported function inside a route file,
// which meant the test runner could not reach it — and it turned out to hold the single most
// fragile assumption in the codebase.
//
// THE ASSUMPTION, stated out loud because it is invisible at the call site: think time is read by
// ARRAY ADJACENCY. A gap counts only when events[i] is an icon_selection and events[i-1] is an
// npc_response. Insert any new event type between those two — which is exactly where a per-turn
// measurement row would land — and every latency sample vanishes silently. `avgResponseLatencyMs`
// falls back to 0, classifyPersona takes its fast branch (classify.ts:56), personaConfidence
// returns 1.0, and a clinical output becomes a constant with nothing raised anywhere.
//
// That is why Phase 5's model_calls data went into its own table rather than becoming a seventh
// session_events type. The tests beside this file pin the assumption so that the next person to
// add an event type is told by CI rather than by a wrong report.

import { countRePrompts } from '@/lib/persona/classify'
import type { SessionEventRow } from '@/lib/session/types'

/** v1's fallback when a session produced no icon selections at all (session/page.tsx:402). */
export const DEFAULT_ICONS_PER_MESSAGE = 2

export const iconSelections = (events: readonly SessionEventRow[]) =>
  events.filter((event) => event.type === 'icon_selection')

export interface SessionMetrics {
  readonly avgResponseLatencyMs: number
  readonly avgIconsPerMessage: number
  readonly rePromptCount: number
  readonly turnCount: number
}

const mean = (xs: readonly number[], fallback: number) =>
  xs.length === 0 ? fallback : xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * Metrics for the persona classifier, derived from the event log rather than from counters the
 * browser kept. v1 accumulated these in refs (latencySamplesRef, iconCountSamplesRef) that died
 * with the tab, and hardcoded re_prompt_count to 0 (session/page.tsx:407), which killed two of
 * the classifier's five branches (finding 2.13).
 */
export function sessionMetrics(events: readonly SessionEventRow[]): SessionMetrics {
  const selections = iconSelections(events)
  const iconsPerTurn = selections.map((event) => (event.payload.icons as string[] | undefined) ?? [])

  // Learner think time: from the NPC's reply landing to the learner submitting.
  // Adjacency-sensitive by design — see the note at the top of this file.
  const latencies: number[] = []
  for (let i = 1; i < events.length; i++) {
    if (events[i].type !== 'icon_selection' || events[i - 1].type !== 'npc_response') continue
    latencies.push(events[i].createdAt.getTime() - events[i - 1].createdAt.getTime())
  }

  return {
    avgResponseLatencyMs: mean(latencies, 0),
    avgIconsPerMessage: mean(
      iconsPerTurn.map((i) => i.length),
      DEFAULT_ICONS_PER_MESSAGE,
    ),
    rePromptCount: countRePrompts(iconsPerTurn),
    turnCount: selections.length,
  }
}
