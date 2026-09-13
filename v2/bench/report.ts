// Renders a bench run. The environment block is the point of the file.
//
// Phases 1 to 4 each recorded a TTFT median and none of them recorded the build, the host, the
// provider or the sample size, so the four numbers cannot be compared to each other or to
// anything since. Every figure below is printed next to the conditions that produced it, or it
// is not printed.

import { formatMs, summarize, type Summary } from '@/lib/measure/stats'
import type { BenchRun, TurnSample } from './types'

const COLD_ORDINAL = 0

export const allTurns = (run: BenchRun): TurnSample[] =>
  run.sessions.flatMap((session) => session.turns)

const row = (label: string, s: Summary): string =>
  `| ${label} | ${s.n} | ${formatMs(s.min, s.n)} | ${formatMs(s.p50, s.n)} | ${formatMs(s.p95, s.n)} | ${formatMs(s.max, s.n)} |`

/** The regions a request actually crossed. `x-vercel-id` is `<edge>::<function>::<id>`. */
export function regionsOf(turns: readonly TurnSample[]): string {
  const seen = new Set(
    turns
      .map((t) => t.vercelId?.split('::').slice(0, 2).join(' -> '))
      .filter((v): v is string => Boolean(v)),
  )
  return seen.size === 0 ? 'unknown' : [...seen].join(', ')
}

export function renderMarkdown(run: BenchRun): string {
  const turns = allTurns(run)
  const warm = turns.filter((t) => t.globalOrdinal !== COLD_ORDINAL)
  const failures = run.sessions.filter((s) => s.error !== null)
  const env = run.environment

  const lines: string[] = [
    `# Bench run ${env.startedAt}`,
    '',
    '## Environment',
    '',
    '| | |',
    '|---|---|',
    `| target | ${env.target} |`,
    `| commit | \`${env.gitSha}\` on \`${env.gitBranch}\` |`,
    `| client | ${env.client} |`,
    `| client vantage | ${env.clientRegion} |`,
    `| edge -> function | ${regionsOf(turns)} |`,
    `| sessions x turns | ${env.sessions} x ${env.turnsPerSession} |`,
    `| concurrency | ${env.concurrency} |`,
    `| turns recorded | ${turns.length} |`,
    `| sessions failed | ${failures.length} |`,
    `| note | ${env.note || '-'} |`,
    '',
    '## Latency, all turns',
    '',
    '| metric | n | min | p50 | p95 | max |',
    '|---|---|---|---|---|---|',
    row('response headers', summarize(turns.map((t) => t.headersMs))),
    row('time to first token (visible)', summarize(turns.map((t) => t.ttftMs))),
    row('time to complete turn', summarize(turns.map((t) => t.ttctMs))),
    row('stream close', summarize(turns.map((t) => t.streamCloseMs))),
    '',
    '## Latency, excluding the first call of the run',
    '',
    'A cold start cannot be read off `x-vercel-id`, so it is not inferred. The first invocation is',
    'simply excluded here and reported above, and the run notes say how long the deployment idled.',
    '',
    '| metric | n | min | p50 | p95 | max |',
    '|---|---|---|---|---|---|',
    row('time to first token (visible)', summarize(warm.map((t) => t.ttftMs))),
    row('time to complete turn', summarize(warm.map((t) => t.ttctMs))),
    '',
    '## Session endpoints',
    '',
    '| metric | n | min | p50 | p95 | max |',
    '|---|---|---|---|---|---|',
    row('POST /api/sessions', summarize(run.sessions.filter((s) => !s.error).map((s) => s.createMs))),
    row('POST /api/sessions/:id/end', summarize(run.sessions.filter((s) => !s.error).map((s) => s.endMs))),
  ]

  if (failures.length > 0) {
    lines.push('', '## Failures', '')
    for (const failure of failures) {
      lines.push(`- session ${failure.sessionOrdinal}: ${failure.error}`)
    }
  }

  lines.push(
    '',
    '## Sessions created',
    '',
    'Recorded so the rows this run added to the production database are enumerable rather than',
    'anonymous. Each one has a public report at `/report/<id>`.',
    '',
    ...run.sessions.filter((s) => s.sessionId).map((s) => `- \`${s.sessionId}\``),
    '',
  )

  return lines.join('\n')
}
