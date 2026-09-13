import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MODEL_TIMEOUT_MS } from '@/lib/ai/model'
import { SCORING_BUDGET_MS, shouldRetryScoring } from '@/lib/scoring/run-scoring'

const T0 = 1_000_000
const deadline = T0 + SCORING_BUDGET_MS

test('a retryable failure early in the budget is retried', () => {
  assert.equal(
    shouldRetryScoring({ retryable: true, attempt: 0, now: T0 + 1_000, deadline }),
    true,
  )
})

test('a non-retryable failure is never retried, however much budget is left', () => {
  assert.equal(shouldRetryScoring({ retryable: false, attempt: 0, now: T0, deadline }), false)
})

test('only the first attempt is retried', () => {
  assert.equal(shouldRetryScoring({ retryable: true, attempt: 1, now: T0, deadline }), false)
})

test('a retry is skipped when a second model call could not finish inside the budget', () => {
  // The wedge this exists to prevent: the end route's after() callback runs inside that route's
  // maxDuration. A first attempt that burns its full 30s timeout, plus the delay, plus a second
  // 30s timeout, exceeds it — so the invocation is killed after scoring_state was set to
  // 'running' and before any terminal write, and the public report says "scoring this session"
  // forever. A recorded failure is worth more than a retry that cannot land.
  const afterAFullTimeout = T0 + MODEL_TIMEOUT_MS
  assert.equal(
    shouldRetryScoring({ retryable: true, attempt: 0, now: afterAFullTimeout, deadline }),
    false,
  )
})

test('the boundary is the last instant a whole second attempt still fits', () => {
  const latest = deadline - MODEL_TIMEOUT_MS - 1_500
  assert.equal(shouldRetryScoring({ retryable: true, attempt: 0, now: latest, deadline }), true)
  assert.equal(shouldRetryScoring({ retryable: true, attempt: 0, now: latest + 1, deadline }), false)
})

test('the budget leaves headroom under the route maxDuration it runs inside', () => {
  assert.ok(SCORING_BUDGET_MS < 60_000, 'must finish inside the route budget')
  assert.ok(
    SCORING_BUDGET_MS >= MODEL_TIMEOUT_MS,
    'one full attempt must always fit, or scoring could never run at all',
  )
})
