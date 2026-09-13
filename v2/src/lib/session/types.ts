import type { ExpressionSummary, LearnerEmotion } from '@/lib/expression/types'
import type { ModeId, PersonaId, ScenarioId } from '@/lib/prompt/types'

export const SESSION_COOKIE = 'sabi_session'
export const MAX_HEARTS = 5

/** How many prior log rows feed the prompt. The S5 fix, enforced server-side. */
export const HISTORY_LIMIT = 12

export const SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export const END_REASONS = ['farewell', 'hearts_exhausted', 'manual', 'turn_cap'] as const
export type EndReason = (typeof END_REASONS)[number]

/**
 * The two endings a turn itself can produce, as opposed to the two the learner produces by
 * running out of hearts or pressing End. Both are EndReasons, and keeping them distinct is the
 * rest of finding S11: until Phase 4 a capped session and a real farewell both travelled as one
 * boolean and both landed as `farewell`, which is why `turn_cap` existed in this list and in the
 * 0001 check constraint without anything ever writing it.
 */
export const COMPLETION_REASONS = ['farewell', 'turn_cap'] as const satisfies readonly EndReason[]
export type CompletionReason = (typeof COMPLETION_REASONS)[number]

/**
 * Whether the session has been scored, and if not, why not. Migration 0003.
 *
 * The report is public and read-only, so it can only ever say what this column says. "Not scored"
 * had to become four distinguishable things, because a scoring call still in flight and a scoring
 * call that failed permanently look identical from `scored_at is null` and one of the two answers
 * is a lie that never expires.
 */
export const SCORING_STATES = ['pending', 'running', 'scored', 'skipped', 'failed'] as const
export type ScoringState = (typeof SCORING_STATES)[number]

export const EVENT_TYPES = [
  'session_start',
  'icon_selection',
  'npc_response',
  'heart_lost',
  'event_fired',
  'session_end',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export interface SessionRow {
  readonly id: string
  readonly scenarioId: ScenarioId
  readonly mode: ModeId
  readonly persona: PersonaId
  readonly personaClassified: PersonaId | null
  readonly status: SessionStatus
  readonly hearts: number
  readonly turnIndex: number
  readonly eventTriggerTurn: number | null
  readonly eventId: string | null
  readonly endReason: EndReason | null
  readonly startedAt: Date
  readonly endedAt: Date | null
  /** Null until the session has been scored. Written only by the scoring path, never by a client. */
  readonly competenceScores: Record<string, unknown> | null
  readonly scoredAt: Date | null
  readonly scoringState: ScoringState
  /** The classified model-error kind when `scoringState` is 'failed'. Null otherwise. */
  readonly scoringError: string | null
}

export interface SessionEventRow {
  readonly seq: number
  readonly type: EventType
  readonly payload: Record<string, unknown>
  readonly createdAt: Date
}

/** Payload of an `icon_selection` event. */
export interface IconSelectionPayload {
  readonly icons: readonly string[]
  readonly translated: string
  readonly turnIndex: number
  readonly npcInitiated: boolean
}

/**
 * What the learner's face did during the window that preceded this turn, plus the label the model
 * gave it. Null when there was no camera, no permission, or no face.
 *
 * It rides `npc_response` rather than `icon_selection` because `npc_response` is the one event
 * written on every turn: an NPC bump has no icon selection (api/dialogue/route.ts passes
 * `iconSelection: null`), and the silence before a bump is exactly the window worth recording.
 */
export interface LearnerExpressionRecord extends ExpressionSummary {
  readonly learnerEmotion: LearnerEmotion | null
  readonly sampleCount: number
}

/** Payload of an `npc_response` event. */
export interface NpcResponsePayload {
  readonly content: string
  readonly npcEmotion: string
  readonly turnIndex: number
  readonly npcInitiated: boolean
  /** Phase 3. Absent on rows written before it, so every reader must treat it as optional. */
  readonly learnerExpression?: LearnerExpressionRecord | null
}
