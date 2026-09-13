import assert from 'node:assert/strict'
import { test } from 'node:test'

import { measureModelCall } from '@/lib/ai/measure'

// Captured verbatim from a real streamText call through the AI Gateway on 2026-09-13, trimmed to
// the fields this module reads. If the gateway changes shape, the negative tests below are what
// turns that into a visible null rather than a silently wrong number.
const REAL_USAGE = {
  inputTokens: 228,
  inputTokenDetails: { noCacheTokens: 228, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokens: 37,
  outputTokenDetails: {},
  totalTokens: 265,
}

const REAL_PERFORMANCE = {
  stepTimeMs: 1368.985584,
  responseTimeMs: 1359.827667,
  timeToFirstOutputMs: 1124.082375,
}

const REAL_PROVIDER_METADATA = {
  anthropic: { usage: { input_tokens: 228, output_tokens: 37 } },
  gateway: {
    routing: {
      originalModelId: 'anthropic/claude-haiku-4.5',
      canonicalSlug: 'anthropic/claude-haiku-4.5',
      finalProvider: 'anthropic',
    },
    cost: '0.000413',
    inputInferenceCost: '0.000228',
    outputInferenceCost: '0.000185',
    generationId: 'gen_01M2DB8YBSZ53Y6S8V1YYENPVF',
  },
}

const base = {
  route: 'dialogue' as const,
  requestedModelId: 'anthropic/claude-haiku-4.5',
  totalMs: 1400,
}

test('a real gateway response yields tokens, cost and both timings', () => {
  const m = measureModelCall({
    ...base,
    ttftVisibleMs: 1310,
    usage: REAL_USAGE,
    performance: REAL_PERFORMANCE,
    providerMetadata: REAL_PROVIDER_METADATA,
    finishReason: 'stop',
  })

  assert.equal(m.inputTokens, 228)
  assert.equal(m.outputTokens, 37)
  assert.equal(m.cacheReadTokens, 0)
  assert.equal(m.costUsd, '0.000413')
  assert.equal(m.generationId, 'gen_01M2DB8YBSZ53Y6S8V1YYENPVF')
  assert.equal(m.provider, 'anthropic')
  assert.equal(m.resolvedModelId, 'anthropic/claude-haiku-4.5')
  assert.equal(m.ttftModelMs, 1124.082375)
  assert.equal(m.ttftVisibleMs, 1310)
  assert.equal(m.finishReason, 'stop')
  assert.equal(m.metadataOk, true)
})

test('cost stays a decimal string and is never floated', () => {
  const m = measureModelCall({ ...base, providerMetadata: REAL_PROVIDER_METADATA })
  assert.equal(typeof m.costUsd, 'string')
  // The whole reason: this value goes into numeric(12,8) and gets summed across a session.
  assert.equal(m.costUsd, '0.000413')
})

test('visible TTFT is later than model TTFT, because the schema puts emotion before reply', () => {
  const m = measureModelCall({
    ...base,
    ttftVisibleMs: 1310,
    performance: REAL_PERFORMANCE,
  })
  assert.ok(
    m.ttftVisibleMs! > m.ttftModelMs!,
    'the learner cannot see a token before the model produced one',
  )
})

test('a gateway block that changed shape yields nulls and flags itself, never zeros', () => {
  const m = measureModelCall({
    ...base,
    usage: REAL_USAGE,
    providerMetadata: { gateway: { cost: 413, generationId: ['nope'] } },
  })

  assert.equal(m.metadataOk, false, 'a shape change must be visible in the data')
  assert.equal(m.costUsd, null)
  assert.notEqual(m.costUsd, '0', 'an unreadable cost must not masquerade as a free call')
  assert.equal(m.generationId, null)
  // Usage is parsed independently, so a gateway change does not cost us the token counts.
  assert.equal(m.inputTokens, 228)
})

test('the direct Anthropic path has no gateway block, and that is not a failure', () => {
  const m = measureModelCall({
    ...base,
    usage: REAL_USAGE,
    performance: REAL_PERFORMANCE,
    providerMetadata: { anthropic: { usage: {} } },
  })

  assert.equal(m.metadataOk, true, 'no gateway report is expected on SABI_MODEL_PROVIDER=anthropic')
  assert.equal(m.costUsd, null, 'and it still must not invent a cost')
  assert.equal(m.inputTokens, 228)
})

test('a call with nothing readable still produces a row', () => {
  const m = measureModelCall({ ...base, totalMs: 900 })

  assert.equal(m.totalMs, 900)
  assert.equal(m.requestedModelId, 'anthropic/claude-haiku-4.5')
  assert.equal(m.inputTokens, null)
  assert.equal(m.costUsd, null)
  assert.equal(m.ttftModelMs, null)
})

test('measuring never throws, whatever the provider hands back', () => {
  for (const junk of [null, undefined, 'string', 42, [], { gateway: null }]) {
    assert.doesNotThrow(() =>
      measureModelCall({ ...base, usage: junk, performance: junk, providerMetadata: junk }),
    )
  }
})

test('a non-finite duration is rejected rather than recorded as a number', () => {
  const m = measureModelCall({ ...base, performance: { timeToFirstOutputMs: Number.NaN } })
  assert.equal(m.ttftModelMs, null)
})
