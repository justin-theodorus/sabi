// Reads back what a bench run cost. `npm run bench:cost -- [--since=ISO] [--session=<uuid>]`
//
// Separate from bench/run.ts, and a separate npm script, because it needs DATABASE_URL while the
// timing leg needs no secret at all — anyone can point `npm run bench` at a URL and get latency
// numbers. Only the person holding the database can join those to tokens and cost.
//
// The numbers here come from `model_calls`, which the three model call sites write on every call
// (dialogue, judge, scoring). Costs are summed as DECIMAL STRINGS in Postgres rather than as
// floats in JavaScript, for the reason 0004_model_calls.sql gives.

import { db } from '@/lib/db'

const flag = (name: string): string | null => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

interface RouteRow {
  route: string
  calls: string
  sessions: string
  total_cost: string | null
  unreadable: string
  p50_ttft_model: string | null
  p50_ttft_visible: string | null
  p50_total: string | null
  p95_total: string | null
  avg_input: string | null
  avg_output: string | null
}

const n = (value: string | null): string => (value === null ? 'n/a' : String(Math.round(Number(value))))

async function main(): Promise<void> {
  const since = flag('since') ?? new Date(Date.now() - 24 * 3600_000).toISOString()

  // One statement: the Neon HTTP driver is one-statement-per-call.
  const rows = (await db()`
    select
      route,
      count(*)::text                                                     as calls,
      count(distinct session_id)::text                                   as sessions,
      sum(cost_usd)::text                                                as total_cost,
      count(*) filter (where cost_usd is null or not metadata_ok)::text  as unreadable,
      percentile_disc(0.5) within group (order by ttft_model_ms)::text   as p50_ttft_model,
      percentile_disc(0.5) within group (order by ttft_visible_ms)::text as p50_ttft_visible,
      percentile_disc(0.5) within group (order by total_ms)::text        as p50_total,
      percentile_disc(0.95) within group (order by total_ms)::text       as p95_total,
      avg(input_tokens)::text                                            as avg_input,
      avg(output_tokens)::text                                           as avg_output
    from model_calls
    where created_at >= ${since}
    group by route
    order by route
  `) as unknown as RouteRow[]

  if (rows.length === 0) {
    console.log(`no model_calls since ${since}`)
    return
  }

  console.log(`\nModel calls since ${since}\n`)
  console.log(
    '| route | calls | sessions | p50 ttft model | p50 ttft visible | p50 total | p95 total | avg in | avg out | cost USD | unreadable |',
  )
  console.log('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    console.log(
      `| ${r.route} | ${r.calls} | ${r.sessions} | ${n(r.p50_ttft_model)}ms | ${n(r.p50_ttft_visible)}ms | ` +
        `${n(r.p50_total)}ms | ${n(r.p95_total)}ms | ${n(r.avg_input)} | ${n(r.avg_output)} | ` +
        `${r.total_cost ?? 'n/a'} | ${r.unreadable} |`,
    )
  }

  // Per session, which is the half that needs the judge and scoring calls to have been recorded.
  const perSession = (await db()`
    select
      count(*)::text        as sessions,
      avg(calls)::text      as avg_calls,
      avg(cost)::text       as avg_cost,
      max(cost)::text       as max_cost,
      sum(cost)::text       as total_cost
    from (
      select session_id, count(*) as calls, sum(cost_usd) as cost
      from model_calls
      where created_at >= ${since} and session_id is not null
      group by session_id
    ) s
  `) as unknown as { sessions: string; avg_calls: string | null; avg_cost: string | null; max_cost: string | null; total_cost: string | null }[]

  const s = perSession[0]
  console.log(`\nPer session over ${s.sessions} session(s):`)
  console.log(`  model calls   avg ${n(s.avg_calls)}`)
  console.log(`  cost          avg $${s.avg_cost ?? 'n/a'}   max $${s.max_cost ?? 'n/a'}`)
  console.log(`  cost, total   $${s.total_cost ?? 'n/a'}`)

  // Per-frame inference cost, read off the turns themselves. Every real session on every real
  // device self-reports, so this needs no separate benchmark page and no device lab.
  const frames = (await db()`
    select
      payload -> 'frameInference' ->> 'device' as device,
      count(*)::text                          as turns,
      sum((payload -> 'frameInference' ->> 'n')::int)::text as frames,
      avg((payload -> 'frameInference' ->> 'p50')::numeric)::text as avg_p50,
      max((payload -> 'frameInference' ->> 'max')::numeric)::text as worst
    from session_events
    where type = 'npc_response' and payload -> 'frameInference' is not null
      and payload -> 'frameInference' <> 'null'::jsonb
    group by 1
    order by 2 desc
  `) as unknown as { device: string; turns: string; frames: string; avg_p50: string; worst: string }[]

  if (frames.length === 0) {
    console.log('\nNo per-frame inference recorded yet (no session has run with a camera).')
  } else {
    console.log('\nPer-frame landmarker cost, by device:\n')
    console.log('| device | turns | frames | mean of per-turn p50 | worst single frame |')
    console.log('|---|---|---|---|---|')
    for (const f of frames) {
      console.log(
        `| ${f.device} | ${f.turns} | ${f.frames} | ${Number(f.avg_p50).toFixed(2)}ms | ${Number(f.worst).toFixed(2)}ms |`,
      )
    }
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
