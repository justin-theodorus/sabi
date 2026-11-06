// The client-side end of the error taxonomy.
//
// The server classifies the failure (lib/ai/errors.ts) and sends the category as a `data-error`
// part. This carries that category through the fetch rejection so the reducer receives a kind
// rather than a raw provider string, which is what Phase 1 rendered straight into a banner a
// child reads.

import type { TurnErrorKind } from '@/lib/turn/types'

export class TurnFailure extends Error {
  readonly kind: TurnErrorKind

  constructor(kind: TurnErrorKind) {
    super(`turn failed: ${kind}`)
    this.name = 'TurnFailure'
    this.kind = kind
  }
}

/**
 * `null` means "not a recognised failure", and the caller picks a default appropriate to what it
 * was doing. A failed fetch is the one case the client can categorise by itself: the server never
 * got the chance to.
 */
export function toTurnErrorKind(error: unknown): TurnErrorKind | null {
  if (error instanceof TurnFailure) return error.kind
  if (error instanceof TypeError) return 'network'
  return null
}
