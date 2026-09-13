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
  /** Null until the session has been scored. Written only by /api/sessions/[id]/score. */
  readonly competenceScores: Record<string, unknown> | null
  readonly scoredAt: Date | null
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
