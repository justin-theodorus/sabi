import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LoadAPIKeyError, NoOutputGeneratedError, RetryError, TypeValidationError } from 'ai'

import { classifyModelError } from '@/lib/ai/errors'
import { TURN_ERROR_MESSAGES } from '@/lib/turn/error-messages'
import type { TurnErrorKind } from '@/lib/turn/types'
import { apiCallError, noObjectGeneratedError } from '@/test/model-mock'

// v1 handled exactly one error class (anthropic.RateLimitError) at two of six call sites, so
// every other failure was an unhandled 500. One row per category, so none can silently collapse
// into another the way they all did in v1.
const STATUS_CASES: readonly (readonly [number, TurnErrorKind, boolean])[] = [
  [429, 'rate_limited', true],
  [408, 'timeout', true],
  [401, 'provider_rejected', false],
  [403, 'provider_rejected', false],
  [500, 'provider_overloaded', true],
  [503, 'provider_overloaded', true],
  [529, 'provider_overloaded', true],
]

for (const [status, kind, retryable] of STATUS_CASES) {
  test(`a ${status} from the provider is ${kind}`, () => {
    const classified = classifyModelError(apiCallError(status))
    assert.equal(classified.kind, kind)
    assert.equal(classified.retryable, retryable)
  })
}

test('a retryable failure is still classified after the SDK wraps it in a RetryError', () => {
  // maxRetries exhausting replaces the APICallError with a RetryError holding the originals, so
  // the status code is only visible through the wrapper.
  const wrapped = new RetryError({
    message: 'failed after 3 attempts',
    reason: 'maxRetriesExceeded',
    errors: [apiCallError(429, true), apiCallError(429, true)],
  })

  assert.equal(classifyModelError(wrapped).kind, 'rate_limited')
})

test('a nested RetryError is unwrapped rather than giving up', () => {
  const inner = new RetryError({
    message: 'inner',
    reason: 'maxRetriesExceeded',
    errors: [apiCallError(401)],
  })
  const outer = new RetryError({ message: 'outer', reason: 'maxRetriesExceeded', errors: [inner] })

  assert.equal(classifyModelError(outer).kind, 'provider_rejected')
})

test('a timeout is distinguished from a cancellation', () => {
  const timeout = new Error('timed out')
  timeout.name = 'TimeoutError'
  assert.equal(classifyModelError(timeout).kind, 'timeout')
  assert.equal(classifyModelError(timeout).retryable, true)

  const aborted = new Error('aborted')
  aborted.name = 'AbortError'
  assert.equal(classifyModelError(aborted).kind, 'cancelled')
  assert.equal(classifyModelError(aborted).retryable, false)
})

test('a missing API key is an operator problem, not a retryable one', () => {
  const error = new LoadAPIKeyError({ message: 'API key is missing' })
  const classified = classifyModelError(error)

  assert.equal(classified.kind, 'provider_rejected')
  assert.equal(classified.retryable, false)
})

test('unparsable model output is malformed_output, and the raw text is kept for the log', () => {
  const error = noObjectGeneratedError('{"summary":"did fine"}')

  const classified = classifyModelError(error)
  assert.equal(classified.kind, 'malformed_output')
  // The outer category must win: eagerly walking to the deepest cause loses it entirely.
  assert.match(classified.log, /\{"summary":"did fine"\}/)
})

test('a bare TypeValidationError is also malformed_output', () => {
  const error = new TypeValidationError({ value: { a: 1 }, cause: new Error('bad shape') })
  assert.equal(classifyModelError(error).kind, 'malformed_output')
})

test('NoOutputGeneratedError is its own category, not a masked success', () => {
  // This is what the learner used to see for an invalid API key: the SDK builds it fresh with no
  // cause once zero steps are recorded, discarding the real 401.
  const error = new NoOutputGeneratedError({
    message: 'No output generated. Check the stream for errors.',
  })

  assert.equal(classifyModelError(error).kind, 'no_output')
})

test('the real cause wins when it is reachable through the cause chain', () => {
  const error = new Error('stream failed')
  error.cause = apiCallError(429, true)
  assert.equal(classifyModelError(error).kind, 'rate_limited')
})

test('a failed connection is network', () => {
  assert.equal(classifyModelError(new TypeError('fetch failed')).kind, 'network')
})

test('anything unrecognised falls back to stream_failed rather than throwing', () => {
  assert.equal(classifyModelError(new Error('who knows')).kind, 'stream_failed')
  assert.equal(classifyModelError('a string').kind, 'stream_failed')
  assert.equal(classifyModelError(null).kind, 'stream_failed')
  assert.equal(classifyModelError(undefined).kind, 'stream_failed')
})

test('a 4xx that is not otherwise categorised does not claim to be an overload', () => {
  assert.equal(classifyModelError(apiCallError(400)).kind, 'stream_failed')
})

test('every kind has learner-facing copy, so none can reach the UI uncovered', () => {
  const kinds = Object.keys(TURN_ERROR_MESSAGES) as TurnErrorKind[]
  for (const kind of kinds) {
    const copy = TURN_ERROR_MESSAGES[kind]
    // 'cancelled' is deliberately silent: the learner navigated away.
    if (kind === 'cancelled') {
      assert.equal(copy, '')
      continue
    }
    assert.ok(copy.length > 0, kind)
    assert.ok(!copy.includes('undefined'), kind)
  }
})

test('no learner-facing copy leaks provider vocabulary at a child', () => {
  for (const copy of Object.values(TURN_ERROR_MESSAGES)) {
    for (const leak of ['API', 'token', 'HTTP', '401', 'schema', 'stream', 'null']) {
      assert.ok(!copy.includes(leak), `"${copy}" leaks "${leak}"`)
    }
  }
})

// The AI Gateway is the default route (lib/ai/model.ts), and its errors arrive with the marker
// symbol stripped: a bad AI_GATEWAY_API_KEY is a plain Error whose `name` is "GatewayError" and
// which carries no statusCode, no cause and no type. Verified by probing the installed package
// and then end to end against a running server. Matching on the name is the only thing available.
const gatewayError = (name: string, message = 'gateway failed'): Error => {
  const error = new Error(message)
  error.name = name
  return error
}

test('an unauthenticated gateway is provider_rejected, not a generic stream failure', () => {
  const error = gatewayError(
    'GatewayError',
    'Unauthenticated. Configure AI_GATEWAY_API_KEY or use a provider module.',
  )

  const classified = classifyModelError(error)
  assert.equal(classified.kind, 'provider_rejected')
  // Telling a child to try again when the key is wrong is worse than telling them nothing.
  assert.equal(classified.retryable, false)
  assert.match(classified.log, /AI_GATEWAY_API_KEY/)
})

test('gateway failures map to the same categories as provider ones', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['GatewayAuthenticationError', 'provider_rejected'],
    ['GatewayForbiddenError', 'provider_rejected'],
    ['GatewayRateLimitError', 'rate_limited'],
    ['GatewayInternalServerError', 'provider_overloaded'],
    ['GatewayFailedDependencyError', 'provider_overloaded'],
    ['GatewayResponseError', 'malformed_output'],
    ['GatewayModelNotFoundError', 'provider_rejected'],
  ]

  for (const [name, kind] of cases) {
    assert.equal(classifyModelError(gatewayError(name)).kind, kind, name)
  }
})

test('an unrecognised error carries its class name into the log', () => {
  // Otherwise the operator cannot tell what to add a branch for.
  const classified = classifyModelError(gatewayError('SomeBrandNewError', 'unheard of'))

  assert.equal(classified.kind, 'stream_failed')
  assert.match(classified.log, /SomeBrandNewError/)
})
