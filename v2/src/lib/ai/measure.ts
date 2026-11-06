// Reading what a model call cost, defensively.
//
// Phase 5 wants tokens and cost per turn and per session. The AI Gateway reports both, which is
// the reason model.ts defaults to it — but `providerMetadata` is typed `JSONValue` by the SDK, so
// the gateway can change that shape without an SDK release and TypeScript would never notice.
//
// That is the same hazard as tests/locust/locustfile.py:276, which read a `translation` key that
// has never existed in either version of this project: every load-test run silently fell back to
// `" ".join(icons)` and nobody found out for a year, because a silent fallback looks exactly like
// a working system. So this module parses, and a parse failure is RECORDED rather than absorbed.
//
// The rule that follows from that: a cost we could not read is null, never 0. An unknown cost and
// a free call are different facts, and summing nulls-as-zeros into a committed dollar figure is
// precisely how this repo acquired six unverifiable performance claims in the first place.

import { z } from 'zod'

export const MODEL_CALL_ROUTES = ['dialogue', 'judge', 'scoring'] as const
export type ModelCallRoute = (typeof MODEL_CALL_ROUTES)[number]

/**
 * The gateway's own report, as observed against the live gateway on 2026-09-13.
 *
 * Everything is optional because this is untrusted-by-construction: the shape is validated so a
 * change is visible in `metadataOk`, not so a change becomes an exception on a learner's turn.
 * `cost` really is a decimal STRING ("0.000413") and is kept as one all the way into a
 * `numeric(12,8)` column — parsing fractions of a cent through a float and then summing them is
 * how you end up committing a total that is almost right.
 */
const gatewayMetadataSchema = z.object({
  cost: z.string().optional(),
  generationId: z.string().optional(),
  routing: z
    .object({
      canonicalSlug: z.string().optional(),
      finalProvider: z.string().optional(),
    })
    .optional(),
})

/** The AI SDK's own per-step timings. `timeToFirstOutputMs` is time to the first MODEL token. */
const performanceSchema = z.object({
  timeToFirstOutputMs: z.number().optional(),
  responseTimeMs: z.number().optional(),
  stepTimeMs: z.number().optional(),
})

/** v7 usage. Flat counts with a details object beside them; confirmed against a real call. */
const usageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  inputTokenDetails: z
    .object({ cacheReadTokens: z.number().optional(), cacheWriteTokens: z.number().optional() })
    .optional(),
  outputTokenDetails: z.object({ reasoningTokens: z.number().optional() }).optional(),
})

export interface ModelCallMeasurement {
  readonly route: ModelCallRoute
  /** What we asked for. `resolvedModelId` is what the gateway actually routed to. */
  readonly requestedModelId: string
  readonly resolvedModelId: string | null
  readonly provider: string | null
  readonly generationId: string | null
  /** Time to the first token the MODEL produced. Under Output.object that is `{"emotion":"`. */
  readonly ttftModelMs: number | null
  /** Time to the first token a LEARNER sees. Only the dialogue route has one. */
  readonly ttftVisibleMs: number | null
  readonly totalMs: number
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly cacheReadTokens: number | null
  readonly cacheWriteTokens: number | null
  readonly reasoningTokens: number | null
  /** A decimal string, or null when the gateway reported none. NEVER "0" as a stand-in. */
  readonly costUsd: string | null
  readonly finishReason: string | null
  /** False when provider metadata was absent or failed the schema. Makes a shape change visible. */
  readonly metadataOk: boolean
}

export interface MeasureInput {
  readonly route: ModelCallRoute
  readonly requestedModelId: string
  readonly totalMs: number
  readonly ttftVisibleMs?: number | null
  readonly usage?: unknown
  readonly performance?: unknown
  readonly providerMetadata?: unknown
  readonly finishReason?: unknown
}

const numberOrNull = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * Turns one completed model call into a row. Never throws: a call that cannot be measured must
 * still have happened, and the caller is on a learner's request path.
 */
export function measureModelCall(input: MeasureInput): ModelCallMeasurement {
  const usage = usageSchema.safeParse(input.usage)
  const perf = performanceSchema.safeParse(input.performance)

  // The gateway key is absent entirely when SABI_MODEL_PROVIDER=anthropic, which is not a failure
  // — there is simply no cost report on the direct path. Only a PRESENT-but-unparseable gateway
  // block counts as a metadata failure worth flagging.
  const gatewayRaw = (input.providerMetadata as Record<string, unknown> | null | undefined)?.gateway
  const gateway = gatewayRaw === undefined ? null : gatewayMetadataSchema.safeParse(gatewayRaw)

  return {
    route: input.route,
    requestedModelId: input.requestedModelId,
    resolvedModelId: gateway?.success ? (gateway.data.routing?.canonicalSlug ?? null) : null,
    provider: gateway?.success ? (gateway.data.routing?.finalProvider ?? null) : null,
    generationId: gateway?.success ? (gateway.data.generationId ?? null) : null,
    ttftModelMs: perf.success ? numberOrNull(perf.data.timeToFirstOutputMs) : null,
    ttftVisibleMs: input.ttftVisibleMs ?? null,
    totalMs: input.totalMs,
    inputTokens: usage.success ? numberOrNull(usage.data.inputTokens) : null,
    outputTokens: usage.success ? numberOrNull(usage.data.outputTokens) : null,
    cacheReadTokens: usage.success
      ? numberOrNull(usage.data.inputTokenDetails?.cacheReadTokens)
      : null,
    cacheWriteTokens: usage.success
      ? numberOrNull(usage.data.inputTokenDetails?.cacheWriteTokens)
      : null,
    reasoningTokens: usage.success
      ? numberOrNull(usage.data.outputTokenDetails?.reasoningTokens)
      : null,
    costUsd: gateway?.success ? (gateway.data.cost ?? null) : null,
    finishReason: typeof input.finishReason === 'string' ? input.finishReason : null,
    metadataOk: gateway === null ? true : gateway.success,
  }
}
