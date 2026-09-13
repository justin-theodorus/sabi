// What the learner is told, per failure kind.
//
// v1 told them nothing: the swallowed SSE error (finding 3.1) ended the stream silently. Phase 1
// replaced that with one generic line that appended the raw SDK string to a child-facing banner,
// so an invalid API key read as "No output generated. Check the stream for errors."
//
// The copy is deliberately in the NPC's world rather than the system's. None of these failures is
// the learner's fault and none of them costs a heart.

import type { TurnErrorKind } from '@/lib/turn/types'

export const TURN_ERROR_MESSAGES: Record<TurnErrorKind, string> = {
  rate_limited: 'Uncle is serving other customers. Try again in a moment.',
  provider_overloaded: 'Uncle is serving other customers. Try again in a moment.',
  timeout: 'Uncle took too long to answer. Try that again.',
  network: 'Lost the connection. Check your network and try again.',
  provider_rejected: 'Something is wrong on our side, not yours. Nothing you do will fix this one.',
  malformed_output: 'Uncle got muddled. Try saying that again.',
  no_output: 'Uncle got muddled. Try saying that again.',
  cancelled: '',
  stream_failed: 'That turn did not go through. Try again.',
  session_failed: 'Could not start the session. Try again.',
}

export const turnErrorMessage = (kind: TurnErrorKind): string => TURN_ERROR_MESSAGES[kind]
