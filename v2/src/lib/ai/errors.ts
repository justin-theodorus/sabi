// One place where a model failure becomes a category.
//
// Finding S5: v1 handled exactly one error class, `anthropic.RateLimitError`, at two of its six
// call sites (main.py:560, :648). /hint, /judge, /score-session and /summarize-emotion had no
// try/except around the model call at all, so a connection error, an overload, a timeout and a
// malformed response were indistinguishable 500s.
//
// The AI SDK makes this worse before it makes it better. streamText never throws on a provider
// failure: the failure becomes an error part inside the stream, and if zero steps were recorded
// every result promise rejects with a freshly built NoOutputGeneratedError that carries no
// `cause`. That is why an invalid API key reads as "No output generated. Check the stream for
// errors." while the real APICallError with statusCode 401 is discarded. The only reliable
// capture point is streamText's own onError callback, so that is what the routes use.
//
// Retryable failures arrive wrapped: after maxRetries is exhausted the SDK raises a RetryError
// holding the originals, so the cause has to be unwrapped before the status code is visible.

import { GatewayError } from '@ai-sdk/gateway'
import {
  APICallError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  TypeValidationError,
} from 'ai'

import type { TurnErrorKind } from '@/lib/turn/types'

export interface ClassifiedError {
  readonly kind: TurnErrorKind
  /** Whether trying the same turn again could plausibly succeed. */
  readonly retryable: boolean
  /** Server-side detail. Never sent to the learner. */
  readonly log: string
}

const UNWRAP_LIMIT = 5

/**
 * Shared by APICallError and the AI Gateway's own hierarchy, which carries the same statusCode and
 * isRetryable but does not extend AISDKError. The gateway is the default route (lib/ai/model.ts),
 * so missing this branch is how a bad AI_GATEWAY_API_KEY reads as a generic stream failure.
 */
function fromStatus(
  status: number | undefined,
  isRetryable: boolean,
  message: string,
): ClassifiedError {
  const log = `provider ${status ?? 'no-status'}: ${message}`

  if (status === 429) return { kind: 'rate_limited', retryable: true, log }
  if (status === 408) return { kind: 'timeout', retryable: true, log }
  if (status === 401 || status === 403) return { kind: 'provider_rejected', retryable: false, log }
  if (status !== undefined && status >= 500) {
    return { kind: 'provider_overloaded', retryable: true, log }
  }
  return { kind: 'stream_failed', retryable: isRetryable, log }
}

const isNamed = (error: unknown, name: string): boolean =>
  error instanceof Error && error.name === name

/**
 * The AI Gateway is the default route (lib/ai/model.ts), and its errors do not always arrive
 * intact: an invalid AI_GATEWAY_API_KEY surfaces as a plain Error whose `name` is
 * "GatewayAuthenticationError", with no statusCode, no cause, and no marker symbol, so
 * GatewayError.isInstance returns false. Verified by probe against the installed package.
 *
 * Matching on the name is therefore not a shortcut, it is the only thing observable. Without it
 * the single most likely operator mistake in this project reads to a child as "try again".
 */
const GATEWAY_KINDS: Record<string, ClassifiedError['kind']> = {
  // The base class, which is what a missing or invalid AI_GATEWAY_API_KEY actually arrives as:
  // "Unauthenticated. Configure AI_GATEWAY_API_KEY or use a provider module." A bare GatewayError
  // with no status is a configuration problem, and the specific transient cases have their own
  // subclasses below, so treating it as retryable would tell a child to keep trying forever.
  GatewayError: 'provider_rejected',
  GatewayAuthenticationError: 'provider_rejected',
  GatewayForbiddenError: 'provider_rejected',
  GatewayRateLimitError: 'rate_limited',
  GatewayInternalServerError: 'provider_overloaded',
  GatewayFailedDependencyError: 'provider_overloaded',
  GatewayResponseError: 'malformed_output',
  GatewayModelNotFoundError: 'provider_rejected',
  GatewayInvalidRequestError: 'stream_failed',
}

const RETRYABLE_KINDS = new Set(['rate_limited', 'provider_overloaded', 'malformed_output'])

function fromGatewayName(error: unknown): ClassifiedError | null {
  if (!(error instanceof Error)) return null

  const kind = GATEWAY_KINDS[error.name]
  if (kind === undefined) return null

  return { kind, retryable: RETRYABLE_KINDS.has(kind), log: `${error.name}: ${error.message}` }
}

/**
 * Recognises one link of the cause chain, or returns null so the caller looks further in.
 *
 * Order matters. NoObjectGeneratedError wraps a TypeValidationError which wraps the validator's
 * own error, so an eager walk to the deepest cause loses the category entirely.
 */
function classifyOne(error: unknown): ClassifiedError | null {
  // AbortSignal.timeout rejects with a TimeoutError; a caller going away gives an AbortError.
  if (isNamed(error, 'TimeoutError')) {
    return { kind: 'timeout', retryable: true, log: 'model call exceeded the request timeout' }
  }
  if (isNamed(error, 'AbortError')) {
    return { kind: 'cancelled', retryable: false, log: 'request aborted by the caller' }
  }

  if (APICallError.isInstance(error)) {
    return fromStatus(error.statusCode, error.isRetryable, error.message)
  }

  if (GatewayError.isInstance(error)) {
    return fromStatus(error.statusCode, error.isRetryable, error.message)
  }

  const byName = fromGatewayName(error)
  if (byName !== null) return byName

  if (LoadAPIKeyError.isInstance(error)) {
    return { kind: 'provider_rejected', retryable: false, log: `credentials: ${error.message}` }
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return {
      kind: 'malformed_output',
      retryable: true,
      log: `model output failed the schema: ${error.text ?? '<no text>'}`,
    }
  }

  if (TypeValidationError.isInstance(error)) {
    return { kind: 'malformed_output', retryable: true, log: `type validation: ${error.message}` }
  }

  // Reached when the provider failed before any step was recorded and the SDK discarded the real
  // cause. Distinguished from malformed_output because nothing was produced at all.
  if (NoOutputGeneratedError.isInstance(error)) {
    return { kind: 'no_output', retryable: true, log: `no output: ${error.message}` }
  }

  // undici surfaces a failed connection as a TypeError from fetch.
  if (error instanceof TypeError) {
    return { kind: 'network', retryable: true, log: `transport: ${error.message}` }
  }

  return null
}

export function classifyModelError(error: unknown): ClassifiedError {
  let current = error

  for (let depth = 0; depth < UNWRAP_LIMIT; depth += 1) {
    // Retryable failures arrive wrapped once maxRetries is exhausted; the status code is on the
    // original, so look through the wrapper before trying to categorise it.
    if (RetryError.isInstance(current)) {
      current = current.lastError
      continue
    }

    const classified = classifyOne(current)
    if (classified !== null) return classified

    if (!(current instanceof Error) || current.cause === undefined || current.cause === null) {
      break
    }
    current = current.cause
  }

  // The name is carried into the log because an unrecognised error is exactly the case where the
  // operator needs to know what class it was in order to add a branch above.
  return {
    kind: 'stream_failed',
    retryable: true,
    log: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  }
}
