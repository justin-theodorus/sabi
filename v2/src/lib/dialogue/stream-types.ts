import type { UIMessage } from 'ai'

import type { CompletionReason } from '@/lib/session/types'
import type { TurnErrorKind } from '@/lib/turn/types'

/**
 * The metadata the server sends once, at the end of a turn, as a `data-turn` part alongside the
 * text deltas.
 *
 * v1's equivalent was the SSE `done` event (main.py:672). Everything here is computed
 * server-side from the session row and the reply, so the client is told what happened rather
 * than deciding it.
 */
export interface TurnData {
  readonly turnIndex: number
  readonly hearts: number
  readonly npcEmotion: string
  /** Null while the conversation continues. Finding S11: the reason, not a boolean. */
  readonly completion: CompletionReason | null
  readonly learnerText: string
  readonly activeEventLine: string | null
  readonly seq: number
}

/**
 * Why a turn failed, as a category rather than a provider string.
 *
 * createUIMessageStream's own onError can only return an opaque string, so the classified kind
 * travels as its own data part written before the stream closes. Finding S5.
 */
export interface TurnErrorData {
  readonly kind: TurnErrorKind
  readonly retryable: boolean
}

/** Shared by the route and the client so the payloads cannot drift between them. */
export type SabiUIMessage = UIMessage<never, { turn: TurnData; error: TurnErrorData }>
