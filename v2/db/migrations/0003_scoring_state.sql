-- Whether the session has been scored, and if not, why not.
--
-- 0002 gave the row `competence_scores` and `scored_at`, which between them say "scored" or "not
-- scored". Phase 4 renders a public report, and "not scored" is two genuinely different things to
-- a reader: a scoring call still in flight a second after the session ended, and a scoring call
-- that failed and is never coming back. Without this column the report can only say "not scored
-- yet" to both, which is a lie in the second case and stays a lie forever.
--
-- The states:
--   pending  the session has not ended, or ended before Phase 4 shipped
--   running  scoring has been scheduled in the end route's after() callback
--   scored   competence_scores is populated; the 0002 constraint holds
--   skipped  too few learner turns to score (NotEnoughTurnsError), which is not a failure
--   failed   the model call failed; scoring_error carries the classified error kind
--
-- `failed` is a first-class outcome rather than an absence, which is the whole point: an absent
-- score is recoverable and an invented one is not (see lib/scoring/schema.ts), so the report has
-- to be able to say so out loud.

alter table sessions
  add column if not exists scoring_state text not null default 'pending',
  add column if not exists scoring_error text;

alter table sessions
  drop constraint if exists scoring_state_is_known;

alter table sessions
  add constraint scoring_state_is_known
  check (scoring_state in ('pending', 'running', 'scored', 'skipped', 'failed'));

-- Sessions scored before this migration existed are already 'scored'. This runs BEFORE the
-- constraint below, because add constraint validates existing rows immediately and every
-- already-scored session would otherwise violate it.
update sessions set scoring_state = 'scored' where competence_scores is not null;

-- A score and the state that describes it cannot disagree. The 0002 constraint already ties
-- competence_scores to scored_at; this ties both to the state a reader is shown.
alter table sessions
  drop constraint if exists scoring_state_agrees_with_scores;

alter table sessions
  add constraint scoring_state_agrees_with_scores
  check ((scoring_state = 'scored') = (competence_scores is not null));
