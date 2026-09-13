import type { UIMessage } from 'ai'

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
  readonly sessionComplete: boolean
  readonly learnerText: string
  readonly activeEventLine: string | null
  readonly seq: number
}

/** Shared by the route and the client so the `data-turn` payload cannot drift between them. */
export type SabiUIMessage = UIMessage<never, { turn: TurnData }>
