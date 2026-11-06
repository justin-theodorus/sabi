// The eval runner. `npm run eval`.
//
// Deliberately NOT under src/, so `npm test`'s src/**/*.test.ts glob cannot pick it up and an
// ordinary push never spends money. CI runs it on workflow_dispatch only.
//
// Cost: 10 fixtures x RUNS_PER_FIXTURE calls, cents per run on Haiku and still cents on a larger
// model. `npm run eval -- --model=claude-sonnet-5` runs the whole suite against another model and
// stamps the id into the result file, which is how finding 2.22 gets answered with two files
// rather than with an opinion.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scoringModelId } from '@/lib/ai/model'
import { scoreSession } from '@/lib/scoring/score-session'
import { overallScore, SCORE_DIMENSIONS, type ScoreDimension } from '@/lib/scoring/schema'
import { buildScoringTranscript } from '@/lib/scoring/transcript'
import type { SessionEventRow } from '@/lib/session/types'
import { assertEvals, type EvalReport } from './assertions'
import type { Fixture, FixtureRun } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(HERE, 'fixtures')
const RESULTS_DIR = join(HERE, 'results')

/** Enough to see variance without paying for it three times over on every dimension. */
const RUNS_PER_FIXTURE = 3

async function loadFixtures(): Promise<Fixture[]> {
  const files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith('.json')).sort()
  const fixtures: Fixture[] = []

  for (const file of files) {
    fixtures.push(JSON.parse(await readFile(join(FIXTURES_DIR, file), 'utf8')) as Fixture)
  }
  return fixtures
}

/** The fixture's events, in the row shape the production code reads. */
const toRows = (fixture: Fixture): SessionEventRow[] =>
  fixture.events.map((event, index) => ({
    seq: index,
    type: event.type,
    payload: event.payload,
    createdAt: new Date(index * 1000),
  }))

async function runFixture(fixture: Fixture): Promise<FixtureRun> {
  const turns = buildScoringTranscript(toRows(fixture))
  const runs: FixtureRun['runs'][number][] = []

  for (let attempt = 0; attempt < RUNS_PER_FIXTURE; attempt += 1) {
    try {
      const result = await scoreSession({ scenarioId: fixture.scenarioId, turns })
      const scores = Object.fromEntries(
        SCORE_DIMENSIONS.map((key) => [key, result[key]]),
      ) as Record<ScoreDimension, number | null>

      runs.push({ scores, overall: overallScore(result), summary: result.summary })
    } catch (error) {
      return {
        fixtureId: fixture.id,
        tier: fixture.tier,
        runs,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return { fixtureId: fixture.id, tier: fixture.tier, runs }
}

function renderMarkdown(report: EvalReport, results: readonly FixtureRun[]): string {
  const rows = results.map((result) => {
    if (result.runs.length === 0) return `| ${result.fixtureId} | ${result.tier} | FAILED: ${result.error} |||||`

    // A dimension every run declined renders as `n/o`, not as 0. Averaging a not-observed
    // dimension into a number is exactly the distortion nullability removes.
    const mean = (key: ScoreDimension) => {
      const observed = result.runs
        .map((run) => run.scores[key])
        .filter((value): value is number => value !== null)
      if (observed.length === 0) return 'n/o'
      const value = Math.round(observed.reduce((total, v) => total + v, 0) / observed.length)
      return observed.length === result.runs.length ? `${value}` : `${value}*`
    }

    const overalls = result.runs
      .map((run) => run.overall)
      .filter((value): value is number => value !== null)
    const avg = overalls.reduce((a, b) => a + b, 0) / overalls.length
    const sd = Math.sqrt(overalls.reduce((t, v) => t + (v - avg) ** 2, 0) / overalls.length)

    return `| ${result.fixtureId} | ${result.tier} | ${Math.round(avg)} | ±${sd.toFixed(1)} | ${SCORE_DIMENSIONS.map(mean).join(' | ')} |`
  })

  return [
    `# Eval run — ${report.startedAt}`,
    '',
    `Model: ${report.model}. ${RUNS_PER_FIXTURE} runs per fixture.`,
    '',
    '`n/o` means every run returned null for that dimension: nothing in the transcript gave the',
    'learner an opportunity to demonstrate it. A trailing `*` means some runs scored it and some',
    'declined it, and the number is the mean of the ones that scored it.',
    '',
    `**${report.passed ? 'PASS' : 'FAIL'}** — ${report.checks.filter((c) => c.passed).length}/${report.checks.length} checks.`,
    '',
    '| fixture | tier | overall | sd | ' + SCORE_DIMENSIONS.join(' | ') + ' |',
    '|---|---|---|---|' + SCORE_DIMENSIONS.map(() => '---').join('|') + '|',
    ...rows,
    '',
    '## Checks',
    '',
    ...report.checks.map((check) => `- ${check.passed ? 'PASS' : 'FAIL'} — ${check.name}: ${check.detail}`),
    '',
  ].join('\n')
}

/** `npm run eval -- --model=claude-sonnet-5`. Read here so the whole run uses one model. */
function applyModelFlag(): void {
  const flag = process.argv.find((arg) => arg.startsWith('--model='))
  if (flag) process.env.SABI_SCORING_MODEL = flag.slice('--model='.length)
}

async function main(): Promise<void> {
  applyModelFlag()
  const fixtures = await loadFixtures()
  if (fixtures.length === 0) throw new Error(`no fixtures in ${FIXTURES_DIR}`)

  console.log(
    `scoring ${fixtures.length} fixtures, ${RUNS_PER_FIXTURE} runs each on ${scoringModelId()}...`,
  )

  const results: FixtureRun[] = []
  for (const fixture of fixtures) {
    process.stdout.write(`  ${fixture.id} `)
    const result = await runFixture(fixture)
    console.log(
      result.runs.length === 0
        ? 'FAILED'
        : `ok (${result.runs.map((r) => (r.overall === null ? 'n/o' : Math.round(r.overall))).join(', ')})`,
    )
    results.push(result)
  }

  const report = assertEvals(fixtures, results)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  await writeFile(join(RESULTS_DIR, `${stamp}.json`), JSON.stringify({ report, results }, null, 2))
  await writeFile(join(RESULTS_DIR, `${stamp}.md`), renderMarkdown(report, results))

  console.log('')
  for (const check of report.checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`)
  }
  console.log(`\nresults written to evals/results/${stamp}.{json,md}`)

  if (!report.passed) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
