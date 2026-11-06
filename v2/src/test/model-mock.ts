// Deterministic model doubles for the test suite.
//
// The whole of Phase 2's error taxonomy and the structured-output path are exercised through
// these rather than through a live provider, so `npm test` stays offline, free and repeatable.
// v1 had no equivalent: its only verification was a health check run with ANTHROPIC_API_KEY=stub
// (ci.yml:83), which means no Claude code path was exercised in CI at all (dossier section 5).

import { APICallError, NoObjectGeneratedError, TypeValidationError, type LanguageModel } from 'ai'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'

/** v7 shape: finishReason is {unified, raw} and usage is nested detail objects, not flat counts. */
const ZERO_USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
}

const FINISH = {
  type: 'finish' as const,
  finishReason: { unified: 'stop' as const, raw: undefined },
  usage: ZERO_USAGE,
}

/** Streams `deltas` in order as one text part. Split mid-token to exercise partial parsing. */
export function streamingModel(deltas: readonly string[]): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunkDelayInMs: null,
        initialDelayInMs: null,
        chunks: [
          { type: 'text-start', id: 't1' },
          ...deltas.map((delta) => ({ type: 'text-delta' as const, id: 't1', delta })),
          { type: 'text-end', id: 't1' },
          FINISH,
        ],
      }),
    }),
  }) as unknown as LanguageModel
}

/** Rejects before any chunk is produced, the way a 401 or a connection failure does. */
export function failingModel(error: unknown): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw error
    },
    doGenerate: async () => {
      throw error
    },
  }) as unknown as LanguageModel
}

/** Non-streaming double for the scoring path. */
export function generatingModel(text: string): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: ZERO_USAGE,
      warnings: [],
    }),
  }) as unknown as LanguageModel
}

export function apiCallError(statusCode: number, isRetryable = false): APICallError {
  return new APICallError({
    message: `mock provider error ${statusCode}`,
    url: 'https://mock.invalid/v1/messages',
    requestBodyValues: {},
    statusCode,
    responseBody: JSON.stringify({ error: { type: 'mock', message: 'mock' } }),
    isRetryable,
  })
}

/** The error the SDK raises when output cannot be parsed or fails the schema. */
export function noObjectGeneratedError(text: string): NoObjectGeneratedError {
  return new NoObjectGeneratedError({
    message: 'No object generated: response did not match schema.',
    text,
    cause: new TypeValidationError({ value: text, cause: new Error('schema mismatch') }),
    response: { id: 'mock-response', timestamp: new Date(0), modelId: 'mock' },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    },
    finishReason: 'stop',
  })
}
