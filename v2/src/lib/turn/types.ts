import type { AACIcon } from '@/components/AACBoard'
import type { ExpressionSample, Signals } from '@/lib/expression/types'
import type { ModeId, NpcEmotion, PersonaId, ScenarioId } from '@/lib/prompt/types'
import type { CompletionReason, EndReason } from '@/lib/session/types'

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

/**
 * Every distinct way a turn can fail. Finding S5: v1 had one handled error class at two of six
 * call sites, so the learner saw the same nothing whatever went wrong. Each kind here has a
 * defined user-visible behaviour in `error-messages.ts`, and none of them costs a heart.
 */
export type TurnErrorKind =
  | 'rate_limited'
  | 'provider_overloaded'
  | 'timeout'
  | 'network'
  | 'provider_rejected'
  | 'malformed_output'
  | 'no_output'
  | 'cancelled'
  | 'stream_failed'
  | 'session_failed'

export interface TurnError {
  readonly kind: TurnErrorKind
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
  | { readonly kind: 'dialogue'; readonly id: string; readonly icons: readonly string[]; readonly npcInitiated: boolean; readonly expression: ExpressionWindow }
  | { readonly kind: 'judge'; readonly id: string; readonly learnerText: string; readonly icons: readonly string[]; readonly expression: ExpressionWindow }
  | { readonly kind: 'logEvent'; readonly id: string; readonly type: 'heart_lost' | 'event_fired'; readonly payload: Record<string, unknown> }
  | { readonly kind: 'endSession'; readonly id: string; readonly reason: EndReason }

/** Null means no camera, no permission, or no face — not an empty window. */
export type ExpressionWindow = readonly ExpressionSample[] | null

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

  /**
   * What the learner's face has done since the last turn was sent. `at` is a wall clock here and
   * is made relative to the window start on the way out; see `takeExpression` in the reducer.
   *
   * It is cleared at SUBMIT, not on success. v1 called resetEmotionLog() only after a successful
   * streamDialogue (session/page.tsx:575) and not in the catch below it (:584-587), so a failed
   * turn's samples carried into the next one and the NPC reacted to a face the learner made
   * during a turn that errored (finding 3.8).
   */
  readonly expressionWindow: readonly ExpressionSample[]

  readonly pending: readonly Effect[]

  /**
   * Monotonic, incremented once per enqueued effect. It exists only to make effect ids unique.
   *
   * Until Phase 4 the id was derived from the counters the state happened to hold
   * (`${kind}:${turnIndex}:${transcript.length}:${pending.length}`), which is deterministic but
   * not unique: SESSION_FAILED returns to `lobby` without moving any of them, so a retried start
   * regenerated `createSession:0:0:0`, the drain in use-turn.ts filtered it out as already
   * started, no fetch happened, and the phase sat at `submitting` forever. A dialogue turn that
   * failed before the stream opened had the identical signature. A counter that only ever goes up
   * makes both unrepresentable without giving up purity.
   */
  readonly effectSeq: number
}

export type TurnAction =
  | { readonly type: 'START_REQUESTED'; readonly now: number }
  | { readonly type: 'SESSION_STARTED'; readonly sessionId: string; readonly hearts: number; readonly greeting: string; readonly now: number }
  | { readonly type: 'SESSION_FAILED'; readonly kind: TurnErrorKind }
  | { readonly type: 'ICON_SELECTED'; readonly icon: AACIcon }
  | { readonly type: 'ICON_REMOVED'; readonly index: number }
  | { readonly type: 'SELECTION_CLEARED' }
  | { readonly type: 'SUBMIT_REQUESTED'; readonly now: number }
  | { readonly type: 'JUDGE_VERDICT'; readonly offContext: boolean; readonly icons: readonly string[]; readonly expression: ExpressionWindow; readonly now: number }
  | { readonly type: 'STREAM_STARTED' }
  | { readonly type: 'STREAM_DELTA'; readonly text: string }
  | { readonly type: 'STREAM_METADATA'; readonly turnIndex: number; readonly hearts: number; readonly npcEmotion: NpcEmotion; readonly completion: CompletionReason | null; readonly learnerText: string; readonly activeEventLine: string | null }
  | { readonly type: 'STREAM_FINISHED'; readonly now: number }
  | { readonly type: 'STREAM_FAILED'; readonly kind: TurnErrorKind; readonly now: number }
  | { readonly type: 'HEART_LOST'; readonly reason: 'timeout' | 'off_context'; readonly hearts?: number; readonly now: number }
  | { readonly type: 'END_REQUESTED'; readonly reason: EndReason }
  | { readonly type: 'EFFECT_SETTLED'; readonly id: string }
  | { readonly type: 'EXPRESSION_SAMPLED'; readonly signals: Signals; readonly now: number }
  | { readonly type: 'TICK'; readonly now: number }
