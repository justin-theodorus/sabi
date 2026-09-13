import type { AACIcon } from '@/components/AACBoard'
import type { ModeId, NpcEmotion, PersonaId, ScenarioId } from '@/lib/prompt/types'
import type { EndReason } from '@/lib/session/types'

/**
 * The turn state machine.
 *
 * `idle` is the only phase a timer can act from. Everything that used to be a boolean guard
 * (`npcLoading`, `sessionOver`) is a phase, so "is a stream in flight" and "is the session over"
 * each have exactly one representation. v1 had `npcLoading`, `sessionOver`, a `npcLoadingRef`,
 * and a `sessionOverRef`, plus a stale `hearts - 1 <= 0` re-check 200 lines from the deduction.
 */
export type Phase =
  | 'lobby'
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'bumping'
  | 'over'

export interface TranscriptTurn {
  readonly role: 'learner' | 'npc'
  readonly text: string
  readonly npcEmotion?: NpcEmotion
}

export type TurnErrorKind = 'stream_failed' | 'session_failed' | 'network'

export interface TurnError {
  readonly kind: TurnErrorKind
  readonly message: string
}

/** Frozen for the life of the session; reducer init arguments, not state. */
export interface SessionConfig {
  readonly scenarioId: ScenarioId
  readonly mode: ModeId
  readonly persona: PersonaId
}

/**
 * Work the reducer wants performed. The reducer stays pure and appends effects; a useEffect
 * drains the queue and dispatches results back.
 *
 * Every effect carries an id so the drain is idempotent under React StrictMode's double
 * invocation — which is precisely what made v1 fire two POST /sessions and two end-of-session
 * flows (findings 3.3 and the init effect at session/page.tsx:307-341).
 */
export type Effect =
  | { readonly kind: 'createSession'; readonly id: string }
  | { readonly kind: 'dialogue'; readonly id: string; readonly icons: readonly string[]; readonly npcInitiated: boolean }
  | { readonly kind: 'judge'; readonly id: string; readonly learnerText: string; readonly icons: readonly string[] }
  | { readonly kind: 'logEvent'; readonly id: string; readonly type: 'heart_lost' | 'event_fired'; readonly payload: Record<string, unknown> }
  | { readonly kind: 'endSession'; readonly id: string; readonly reason: EndReason }

export interface TurnState {
  readonly config: SessionConfig
  readonly phase: Phase
  readonly sessionId: string | null

  readonly selected: readonly AACIcon[]
  readonly transcript: readonly TranscriptTurn[]
  readonly streamingText: string

  readonly hearts: number
  readonly turnIndex: number
  readonly npcEmotion: NpcEmotion
  readonly activeEventLine: string | null

  readonly error: TurnError | null
  readonly endReason: EndReason | null

  /** Drives every timer. Reset by any learner action and by any NPC reply landing. */
  readonly lastActivityAt: number
  /** Set when the survival timeout has already fired for the current silence. */
  readonly timeoutCharged: boolean

  readonly pending: readonly Effect[]
}

export type TurnAction =
  | { readonly type: 'START_REQUESTED'; readonly now: number }
  | { readonly type: 'SESSION_STARTED'; readonly sessionId: string; readonly hearts: number; readonly greeting: string; readonly now: number }
  | { readonly type: 'SESSION_FAILED'; readonly message: string }
  | { readonly type: 'ICON_SELECTED'; readonly icon: AACIcon }
  | { readonly type: 'ICON_REMOVED'; readonly index: number }
  | { readonly type: 'SELECTION_CLEARED' }
  | { readonly type: 'SUBMIT_REQUESTED'; readonly now: number }
  | { readonly type: 'JUDGE_VERDICT'; readonly offContext: boolean; readonly icons: readonly string[]; readonly now: number }
  | { readonly type: 'STREAM_STARTED' }
  | { readonly type: 'STREAM_DELTA'; readonly text: string }
  | { readonly type: 'STREAM_METADATA'; readonly turnIndex: number; readonly hearts: number; readonly npcEmotion: NpcEmotion; readonly sessionComplete: boolean; readonly learnerText: string; readonly activeEventLine: string | null }
  | { readonly type: 'STREAM_FINISHED'; readonly now: number }
  | { readonly type: 'STREAM_FAILED'; readonly message: string; readonly now: number }
  | { readonly type: 'HEART_LOST'; readonly reason: 'timeout' | 'off_context'; readonly hearts?: number; readonly now: number }
  | { readonly type: 'END_REQUESTED'; readonly reason: EndReason }
  | { readonly type: 'EFFECT_SETTLED'; readonly id: string }
  | { readonly type: 'TICK'; readonly now: number }
