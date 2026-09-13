-- Competence scores, stored on the session they describe.
--
-- v1 wrote these from the browser: the therapist report page called /score-session and then did
-- supabase.from('sessions').update({ competence_scores: scores }) directly
-- (therapist/sessions/[sessionId]/page.tsx:233). The client both triggered the scoring and owned
-- the write, so a clinical record was whatever the browser decided to put there.
--
-- Here the score is written by the route that produced it, in the same request, and never by the
-- client. `scored_at` is separate from the payload so an unscored session and a session scored
-- with a null result are distinguishable — v1 could not tell those apart, because a failure left
-- competence_scores null and silently retried on the next mount.

alter table sessions
  add column if not exists competence_scores jsonb,
  add column if not exists scored_at         timestamptz;

-- A score without a timestamp, or a timestamp without a score, means someone wrote half of it.
alter table sessions
  drop constraint if exists scores_and_timestamp_agree;

alter table sessions
  add constraint scores_and_timestamp_agree
  check ((competence_scores is null) = (scored_at is null));
