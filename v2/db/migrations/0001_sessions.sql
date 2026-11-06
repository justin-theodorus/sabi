-- Phase 1 schema. Two tables, and deliberately no third store.
--
-- v1 kept live mutable state (hearts, turn_index) in a Redis hash `session:{id}:state` beside
-- the Postgres row that already owned the session, then never wired the updater:
-- session-service/index.js seeds it at :161-168, PUT /sessions/:id/state at :575 would update it,
-- and frontend/src/lib/session.ts:38 (updateSessionState) has zero call sites. So
-- GET /sessions/:id/state reported turn_index 0, hearts 5 for every live session forever, and a
-- mid-session refresh lost the conversation entirely.
--
-- There is no prior art to copy because it never worked. Hearts and turn_index are columns on the
-- row they were shadowing, updated in the same transaction that appends the turn's events.

create table if not exists sessions (
  id                 uuid        primary key,
  scenario_id        text        not null default 'hawker_centre',
  mode               text        not null check (mode in ('learning', 'survival')),

  -- The five Singlish animals. v1's dead vocabulary defaulted new learners to 'guided_learner'
  -- (session-service/index.js:151), which persona-engine rejected with a 400 and dialogue-engine
  -- silently coerced to zippy_sotong, so every first-time learner was prompted as the wrong
  -- persona with nothing logged. Finding 2.14, closed here at the schema level.
  persona            text        not null check (persona in
                       ('zippy_sotong', 'steady_turtle', 'shy_chick', 'garang_crab', 'curious_monkey')),
  persona_classified text        check (persona_classified in
                       ('zippy_sotong', 'steady_turtle', 'shy_chick', 'garang_crab', 'curious_monkey')),

  status             text        not null default 'active'
                       check (status in ('active', 'completed', 'abandoned')),
  hearts             smallint    not null default 5 check (hearts between 0 and 5),
  turn_index         smallint    not null default 0 check (turn_index >= 0),

  -- Rolled server-side at creation. v1 rolled it in the browser (session/page.tsx:321), so it was
  -- neither reproducible nor visible to the therapist-facing log.
  event_trigger_turn smallint,
  event_id           text,

  end_reason         text        check (end_reason in
                       ('farewell', 'hearts_exhausted', 'manual', 'turn_cap')),

  started_at         timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  ended_at           timestamptz,

  constraint ended_sessions_have_a_reason
    check ((status = 'active') = (ended_at is null))
);

-- Append-only. This table IS the transcript: /api/dialogue rebuilds conversation history from it
-- rather than trusting a history array sent by the browser, which is where v1's unbounded prompt
-- growth came from (finding S5 — session/page.tsx:558 passed the full array every turn, with no
-- cap anywhere, while the load test truncated to the last 6 and so never exercised it).
create table if not exists session_events (
  id         bigint      generated always as identity primary key,
  session_id uuid        not null references sessions (id) on delete cascade,

  -- Ordering key. v1 ordered by a `timestamp` column that ties at millisecond resolution.
  -- The unique constraint also makes a duplicate turn write impossible rather than merely
  -- unlikely, which is the class of bug finding 3.7 describes.
  seq        integer     not null check (seq >= 0),

  type       text        not null check (type in (
                 'session_start', 'icon_selection', 'npc_response',
                 'heart_lost', 'event_fired', 'session_end')),
  payload    jsonb       not null default '{}',
  created_at timestamptz not null default now(),

  unique (session_id, seq)
);

create index if not exists session_events_session_seq_idx
  on session_events (session_id, seq);
