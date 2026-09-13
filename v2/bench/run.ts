// The latency bench. `npm run bench -- --url=https://... [--sessions=N] [--turns=T] [--concurrency=C]`
//
// Sibling of evals/, and outside src/ for the same reason: `npm test`'s src/**/*.test.ts glob
// cannot reach it, so an ordinary push can never spend money. Unlike evals/ there is no CI
// workflow at all, because this one drives a DEPLOYED app and every turn is a billed model call.
//
// WHY THIS LIVES HERE AND NOT IN tests/locust/. The rebuild plan says "tests/locust kept; extended
// in Phase 5 to load-test v2", but `tests/` is on the v1-frozen path list in
// .github/workflows/v2.yml, so extending it in place would fail the gate that protects the
// rebuild's one hard constraint. The locust file stays exactly as it is, defect included, and its
// defect is carried forward as an assertion instead — see bench/assert.ts.

import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderMarkdown } from './report'
import { runSession } from './turn'
import type { BenchRun, SessionSample } from './types'

const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results')

/** Money guards. A typo in --concurrency is the one mistake here that turns into a bill. */
const MAX_CALLS_WITHOUT_CONSENT = 200
const MAX_CONCURRENCY = 8

const flag = (name: string): string | null => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const intFlag = (name: string, fallback: number): number => {
  const raw = flag(name)
  if (raw === null) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 1) throw new Error(`--${name} must be a positive integer`)
  return value
}

const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

async function main(): Promise<void> {
  // No default target. A bench that defaults to a URL is a bench that gets run against the wrong
  // one, and this one spends money on every turn.
  const target = flag('url')
  if (!target) {
    throw new Error('--url is required, e.g. --url=https://sabi-lyart.vercel.app')
  }
  const base = target.replace(/\/$/, '')

  const sessions = intFlag('sessions', 1)
  const turnsPerSession = intFlag('turns', 6)
  const concurrency = Math.min(intFlag('concurrency', 1), MAX_CONCURRENCY)
  const note = flag('note') ?? ''

  // Every session with at least MIN_SCOREABLE_TURNS learner turns also triggers a scoring call in
  // the end route's after(). That is wanted — per-session cost has to include it — but it must be
  // stated up front rather than discovered in a bill.
  const dialogueCalls = sessions * turnsPerSession
  const totalCalls = dialogueCalls + sessions
  console.log(
    `bench: ${sessions} session(s) x ${turnsPerSession} turn(s) = ${dialogueCalls} dialogue call(s)\n` +
      `       plus up to ${sessions} scoring call(s) in after(), ~${totalCalls} billed model calls\n` +
      `       against ${base} at concurrency ${concurrency}`,
  )

  if (totalCalls > MAX_CALLS_WITHOUT_CONSENT && flag('yes') === null) {
    throw new Error(
      `${totalCalls} model calls exceeds the ${MAX_CALLS_WITHOUT_CONSENT} guard; pass --yes to confirm`,
    )
  }

  const startedAt = new Date().toISOString()
  let globalOrdinal = 0
  const nextGlobalOrdinal = () => globalOrdinal++

  // Sessions are the unit of concurrency; a fixed worker pool pulls indices off a shared queue.
  const queue = Array.from({ length: sessions }, (_, i) => i)
  const done: SessionSample[] = []

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = queue.shift()
      if (index === undefined) return
      const sample = await runSession(base, index, turnsPerSession, nextGlobalOrdinal)
      console.log(
        sample.error
          ? `  session ${index}: FAILED ${sample.error}`
          : `  session ${index}: ${sample.turns.length} turns, ttft ${sample.turns
              .map((t) => Math.round(t.ttftMs))
              .join(', ')}`,
      )
      done.push(sample)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  done.sort((a, b) => a.sessionOrdinal - b.sessionOrdinal)

  const run: BenchRun = {
    environment: {
      target: base,
      startedAt,
      gitSha: git('rev-parse', '--short', 'HEAD'),
      gitBranch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      client: `node ${process.version} on ${process.platform}/${process.arch}`,
      clientRegion: flag('from') ?? 'unstated',
      sessions,
      turnsPerSession,
      concurrency,
      note,
    },
    sessions: done,
  }

  const stamp = startedAt.replace(/[:.]/g, '-')
  await writeFile(join(RESULTS_DIR, `${stamp}.json`), JSON.stringify(run, null, 2))
  await writeFile(join(RESULTS_DIR, `${stamp}.md`), renderMarkdown(run))

  console.log(`\n${renderMarkdown(run)}`)
  console.log(`results written to bench/results/${stamp}.{json,md}`)

  if (done.some((s) => s.error !== null)) process.exitCode = 1
}

// Top-level await fails under tsx for a .ts file, so this matches db/migrate.ts and evals/run.ts.
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
