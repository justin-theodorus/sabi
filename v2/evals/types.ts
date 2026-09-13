// The eval set for /api/sessions/[id]/score.
//
// Section 5 of the dossier names the absence of this as the single thing that most weakens the
// AI-engineering framing, and there is nothing in v1 to inherit: no golden transcripts, no scored
// fixtures, no harness. This is greenfield.
//
// The fixtures are session event logs in the real SessionEventRow shape, so they flow through the
// same buildScoringTranscript the route uses. Each one is AUTHORED to exhibit a known profile and
// carries its own expectation, which is more defensible than scoring ten captured sessions by eye
// and lets the ambiguous tier be ambiguous by construction.
//
// Assertions are on ordering and on dimension separation, never on exact values. An eval that
// pins `operational === 72` fails on every model upgrade and tells you nothing when it does.

import type { EventType } from '@/lib/session/types'
import type { ScenarioId } from '@/lib/prompt/types'
import type { ScoreDimension } from '@/lib/scoring/schema'

/** Loosely typed on purpose: the fixture is JSON, and the loader asserts the shape. */
export interface FixtureEvent {
  readonly type: EventType
  readonly payload: Record<string, unknown>
}

export type Tier = 'strong' | 'mixed' | 'weak'

export interface Fixture {
  readonly id: string
  readonly tier: Tier
  readonly scenarioId: ScenarioId
  readonly mode: 'learning' | 'survival'
  /** Why this transcript was written the way it was. Read by a human, not by the runner. */
  readonly intent: string
  readonly events: readonly FixtureEvent[]
  readonly expect: {
    /**
     * Each pair asserts the first dimension scores above the second FOR THIS TRANSCRIPT. This is
     * what catches a flat 50-across-the-board response, which tier ordering alone would not.
     */
    readonly dimensionsAbove?: readonly (readonly [ScoreDimension, ScoreDimension])[]
    /**
     * Dimensions that must come back NULL because this session gave no opportunity to observe
     * them. Only `strategic` can be null, and only when nothing in the transcript ever broke.
     */
    readonly notObserved?: readonly ScoreDimension[]
    /**
     * Dimensions that must come back as a NUMBER. The counterpart to the above and the half that
     * actually protects the distinction: a fixture where the NPC signals confusion and the learner
     * never adapts must score low, not null. Without this, "not observed" would become a way for
     * the scorer to decline every hard judgement.
     */
    readonly observed?: readonly ScoreDimension[]
  }
}

export interface FixtureRun {
  readonly fixtureId: string
  readonly tier: Tier
  readonly runs: readonly {
    readonly scores: Record<ScoreDimension, number | null>
    readonly overall: number | null
    readonly summary: string
  }[]
  readonly error?: string
}
