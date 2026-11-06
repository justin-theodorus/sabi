-- What every model call cost, and how long it took.
--
-- Phase 5 wants tokens and cost per turn AND per session. Per session is the harder half: a
-- survival-mode turn makes a /judge call as well as a /dialogue call, and every session that ends
-- with enough turns makes a /scoring call after the response has flushed. Instrumenting only the
-- dialogue route would produce a partial number presented as a whole one, which is the failure
-- this phase exists to correct, not repeat.
--
-- WHY THIS IS ITS OWN TABLE, and not a seventh `session_events` type.
--
-- sessionMetrics (lib/session/metrics.ts) pairs events by strict ARRAY ADJACENCY: it walks the log
-- and only counts a gap when events[i] is an icon_selection and events[i-1] is an npc_response.
-- A model_call row lands exactly between those two. Every latency sample would vanish,
-- `avgResponseLatencyMs` would fall back to 0, classifyPersona would take its fast branch, and
-- personaConfidence would return 1.0 for every session ever recorded. Nothing would error. A
-- clinical output would quietly become a constant.
--
-- Three more reasons, any one of which would be enough on its own:
--   - `seq` is derived inline as (select max(seq)+1) inside commitTurn's transaction, and
--     appendEvent races it by design (unique (session_id, seq) is the referee). Adding a fourth
--     writer means a measurement INSERT can lose that race to a heart_lost — or win it.
--   - Scoring runs in after(), after session_end was appended and status went to 'completed'.
--     A row after the terminal event falsifies the log's own shape.
--   - /report/[sessionId] is public and unauthenticated, and it walks the event log. Cost and
--     generation ids are operator data. They should not live in the structure a stranger reads.
--
-- Nothing in this file touches sessions or session_events, so it cannot break either.

create table if not exists model_calls (
  id                 bigint      generated always as identity primary key,

  -- Nullable on purpose: the eval harness calls the scorer with no session behind it.
  -- Cascade, so deleting a session takes its measurements with it.
  session_id         uuid        references sessions (id) on delete cascade,

  route              text        not null check (route in ('dialogue', 'judge', 'scoring')),

  -- What we asked for, and what the gateway actually routed to. They differ: a request for
  -- `anthropic/claude-haiku-4.5` resolved to provider `anthropic` on one call and `claudeaws` on
  -- the next, which is worth being able to see when a latency number looks odd.
  requested_model_id text        not null,
  resolved_model_id  text,
  provider           text,
  generation_id      text,

  -- Two time-to-first-tokens, because they are two different facts and only one of them is the
  -- number the product is judged on. ttft_model_ms is the SDK's timeToFirstOutputMs: the first
  -- token the MODEL produced, which under Output.object is the opening of `{"emotion":"`.
  -- ttft_visible_ms is the first token a LEARNER sees. Reporting only the first understates the
  -- wait; reporting only the second hides where the wait comes from.
  ttft_model_ms      integer,
  ttft_visible_ms    integer,
  total_ms           integer     not null check (total_ms >= 0),

  input_tokens       integer,
  output_tokens      integer,
  cache_read_tokens  integer,
  cache_write_tokens integer,
  reasoning_tokens   integer,

  -- numeric, not double precision. These are fractions of a cent ("0.000413") that get summed
  -- across a session and then committed to a document as a dollar figure. Float addition is how
  -- you publish a total that is almost right.
  --
  -- Null means the cost could not be read, and is deliberately distinct from 0.00000000, which
  -- would mean a free call. Conflating those is how a project ends up with numbers nobody
  -- measured — see the six UNVERIFIABLE claims this phase supersedes.
  cost_usd           numeric(12, 8),

  finish_reason      text,

  -- False when provider metadata was present but failed its schema. The gateway can change shape
  -- without an SDK release, and `providerMetadata` is typed JSONValue, so nothing else would
  -- notice. This turns that into a visible column rather than a suspiciously cheap month.
  metadata_ok        boolean     not null default true,

  created_at         timestamptz not null default now()
);

create index if not exists model_calls_session_idx on model_calls (session_id, created_at);
