import { db } from '@/lib/db'
import type { ModeId, PersonaId, ScenarioId } from '@/lib/prompt/types'
import {
  HISTORY_LIMIT,
  MAX_HEARTS,
  type EndReason,
  type EventType,
  type SessionEventRow,
  type SessionRow,
} from '@/lib/session/types'

/* eslint-disable @typescript-eslint/no-explicit-any -- the driver returns untyped rows; every
   read goes through one of the mappers below, which is where the shape is asserted. */

const toSession = (row: any): SessionRow => ({
  id: row.id,
  scenarioId: row.scenario_id as ScenarioId,
  mode: row.mode as ModeId,
  persona: row.persona as PersonaId,
  personaClassified: row.persona_classified as PersonaId | null,
  status: row.status,
  hearts: Number(row.hearts),
  turnIndex: Number(row.turn_index),
  eventTriggerTurn: row.event_trigger_turn === null ? null : Number(row.event_trigger_turn),
  eventId: row.event_id,
  endReason: row.end_reason as EndReason | null,
  startedAt: new Date(row.started_at),
  endedAt: row.ended_at === null ? null : new Date(row.ended_at),
  competenceScores: row.competence_scores ?? null,
  scoredAt: row.scored_at === null || row.scored_at === undefined ? null : new Date(row.scored_at),
})

const toEvent = (row: any): SessionEventRow => ({
  seq: Number(row.seq),
  type: row.type as EventType,
  payload: row.payload ?? {},
  createdAt: new Date(row.created_at),
})

export interface CreateSessionInput {
  readonly id: string
  readonly scenarioId: ScenarioId
  readonly mode: ModeId
  readonly persona: PersonaId
  readonly eventTriggerTurn: number
  readonly eventId: string | null
}

export async function createSession(input: CreateSessionInput): Promise<SessionRow> {
  const sql = db()

  const [row] = await sql`
    insert into sessions (id, scenario_id, mode, persona, hearts, event_trigger_turn, event_id)
    values (${input.id}, ${input.scenarioId}, ${input.mode}, ${input.persona},
            ${MAX_HEARTS}, ${input.eventTriggerTurn}, ${input.eventId})
    returning *
  `

  // seq 0 is always session_start, so the log is self-describing from its first row.
  await sql`
    insert into session_events (session_id, seq, type, payload)
    values (${input.id}, 0, 'session_start', ${JSON.stringify({
      scenarioId: input.scenarioId,
      mode: input.mode,
      persona: input.persona,
      eventTriggerTurn: input.eventTriggerTurn,
      eventId: input.eventId,
    })}::jsonb)
  `

  return toSession(row)
}

export async function loadSession(id: string): Promise<SessionRow | null> {
  const [row] = await db()`select * from sessions where id = ${id}`
  return row ? toSession(row) : null
}

/**
 * Appends one event, deriving `seq` in the same statement.
 *
 * Two concurrent appends can compute the same seq, and the unique (session_id, seq) constraint
 * then rejects the loser rather than silently writing a duplicate turn. That is the intended
 * behaviour: v1's equivalent races (finding 3.7) wrote duplicates instead of failing.
 */
export async function appendEvent(
  sessionId: string,
  type: EventType,
  payload: Record<string, unknown> = {},
): Promise<number> {
  const [row] = await db()`
    insert into session_events (session_id, seq, type, payload)
    values (
      ${sessionId},
      (select coalesce(max(seq), -1) + 1 from session_events where session_id = ${sessionId}),
      ${type},
      ${JSON.stringify(payload)}::jsonb
    )
    returning seq
  `
  return Number(row.seq)
}

/**
 * Commits a completed turn: the learner's selection, the NPC's reply, and the turn counter, in
 * one transaction. v1 wrote its two events from the browser as unawaited fire-and-forget calls
 * (session/page.tsx:530, :581) and kept turn_index only in React state.
 */
export async function commitTurn(args: {
  readonly sessionId: string
  readonly iconSelection: Record<string, unknown> | null
  readonly npcResponse: Record<string, unknown>
  readonly hearts: number
  readonly status: 'active' | 'completed'
  readonly endReason: EndReason | null
}): Promise<{ turnIndex: number; seq: number }> {
  const sql = db()
  const { sessionId } = args

  const appendStatement = (type: EventType, payload: Record<string, unknown>) => sql`
    insert into session_events (session_id, seq, type, payload)
    values (
      ${sessionId},
      (select coalesce(max(seq), -1) + 1 from session_events where session_id = ${sessionId}),
      ${type},
      ${JSON.stringify(payload)}::jsonb
    )
    returning seq
  `

  const statements = [
    ...(args.iconSelection ? [appendStatement('icon_selection', args.iconSelection)] : []),
    appendStatement('npc_response', args.npcResponse),
    sql`
      update sessions
         set turn_index   = turn_index + 1,
             hearts       = ${args.hearts},
             status       = ${args.status},
             end_reason   = ${args.endReason},
             ended_at     = ${args.status === 'completed' ? new Date().toISOString() : null},
             last_seen_at = now()
       where id = ${sessionId}
       returning turn_index
    `,
  ]

  const results = await sql.transaction(statements)
  const npcRows = results.at(-2) as Array<{ seq: number }>
  const sessionRows = results.at(-1) as Array<{ turn_index: number }>

  return { turnIndex: Number(sessionRows[0].turn_index), seq: Number(npcRows[0].seq) }
}

/** The transcript, capped. This is where finding S5's unbounded prompt is actually prevented. */
export async function loadHistory(
  sessionId: string,
  limit: number = HISTORY_LIMIT,
): Promise<SessionEventRow[]> {
  const rows = await db()`
    select seq, type, payload, created_at
      from session_events
     where session_id = ${sessionId}
       and type in ('icon_selection', 'npc_response')
     order by seq desc
     limit ${limit}
  `
  return rows.map(toEvent).reverse()
}

export async function loadAllEvents(sessionId: string): Promise<SessionEventRow[]> {
  const rows = await db()`
    select seq, type, payload, created_at
      from session_events
     where session_id = ${sessionId}
     order by seq asc
  `
  return rows.map(toEvent)
}

export async function endSession(args: {
  readonly sessionId: string
  readonly reason: EndReason
  readonly personaClassified: PersonaId | null
}): Promise<SessionRow | null> {
  const [row] = await db()`
    update sessions
       set status             = 'completed',
           end_reason         = ${args.reason},
           persona_classified = ${args.personaClassified},
           ended_at           = coalesce(ended_at, now()),
           last_seen_at       = now()
     where id = ${args.sessionId}
       and status = 'active'
     returning *
  `
  return row ? toSession(row) : null
}

export async function loseHeart(sessionId: string): Promise<number | null> {
  const [row] = await db()`
    update sessions
       set hearts = greatest(hearts - 1, 0), last_seen_at = now()
     where id = ${sessionId} and status = 'active'
     returning hearts
  `
  return row ? Number(row.hearts) : null
}

/**
 * Records a score. Written by the route that produced it, never by the client the way v1's
 * therapist page did (therapist/sessions/[sessionId]/page.tsx:233).
 *
 * The payload and the timestamp are set together, which the 0002 check constraint enforces, so a
 * scored session and an unscored one are always distinguishable.
 */
export async function saveCompetenceScores(
  sessionId: string,
  scores: Record<string, unknown>,
): Promise<void> {
  await db()`
    update sessions
       set competence_scores = ${JSON.stringify(scores)}::jsonb,
           scored_at         = now()
     where id = ${sessionId}
  `
}
