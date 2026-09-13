# Backlog

Anything that is not in the current phase lands here rather than in the branch. Phase numbers
refer to `sabi-rebuild-plan.md`; finding ids (`2.9`, `S5`, `3.1`) refer to `sabi-evidence.md`.

## Deferred out of Phase 1 deliberately

| Item | Phase | Note |
|---|---|---|
| `POST /api/hint` | later | The Learning-mode Sabi hint bar: a second model call 4s after each NPC reply (`SabiHintBar.tsx:25-32`). Not in Phase 1's task list; adds a third route and its own timer to the reducer. |
| TTS | later | ElevenLabs sentence-chunked audio. The design is sound once `2.16` is fixed (v1 gathers every sentence's audio before emitting any, so the listener hears nothing until the slowest call returns). Not load-bearing for either interview angle. |
| Client-side emotion capture | DONE (3) | MediaPipe Face Landmarker blendshapes, in the browser. `PromptInput.emotion` is populated by `/api/dialogue`. |
| Session report at `/report/[sessionId]` | DONE (4) | Public, read-only, no cookie. Transcript, per-turn emotion timeline, competence radar. |
| `/score-session` with tool-use | DONE (2) | Built in Phase 2 as `POST /api/sessions/[id]/score`. Phase 4 renders it. |
| Other three scenarios | — | Needs commissioned art (`2.11`). Single-scenario done properly is the stronger showcase. |
| Video recording to Blob | 5 | Optional. Costs storage and adds a failure mode. |

## Known defects carried forward on purpose

- **`2.9` — RESOLVED in Phase 2.** The keyword classifier is deleted. The NPC's emotion now comes
  from the dialogue call already being made, as a schema-enforced enum declared first in the
  response object (`v2/src/lib/dialogue/npc-reply.ts`), so it survives a reply truncated by the
  256-token cap. Measured over 40 real turns on the production build: 0 `confused`-degenerate
  runs, 0/40 marker misses, and every reply still ends in a question mark — the exact input that
  used to force `confused`. The five tests that pinned the defect were rewritten to the corrected
  expectations in `v2/src/lib/dialogue/npc-emotion.test.ts`, same inputs, so the before/after
  stays legible.

- **`S5` — RESOLVED in Phase 2.** Ten categories in `v2/src/lib/ai/errors.ts`, each with defined
  learner-facing copy in `v2/src/lib/turn/error-messages.ts`, and none of them costs a heart. An
  invalid key now reads as `provider_rejected` with the real cause in the server log, rather than
  "No output generated. Check the stream for errors."

- **`S6` — prompt injection.** `custom_npc_prompt` was dropped from `PromptInput` entirely rather
  than sanitised, since v1 had no legitimate caller for it. `activeEvent` and `availableIcons`
  are now sourced from server-side scenario config rather than the request body, so no
  caller-supplied free text reaches the system prompt in Phase 1. Revisit if any field ever
  becomes client-supplied again.

## Corrections owed to the documentation (Phase 6)

- **The icon count is 128, not 136.** `AACBoard.tsx` has 58 `core_words`, 38 `social`, and 32
  `emotions`. Both the README and `sabi-evidence.md` say 136.
- **`tests/locust/locustfile.py:277` reads a `translation` key that has never existed.**
  `aac-icon-service` returns `{ text }` and so does `/api/translate`. Every load-test run
  silently fell back to `" ".join(icons)`, so the translate leg was timed but its output
  discarded. Fix the test, not the contract, when the load test is rewritten against v2 in
  Phase 5.
- **AACBoard's scenario-icon ids do not match the labels the prompt is given.** The board emits
  `scenario-chicken-rice` (`AACBoard.tsx:221-226`) while the prompt receives the label
  `chicken rice`. Harmless today because the board reports whole icon objects and only labels are
  sent to `/api/translate`, but the two vocabularies should be reconciled.
- **Scenario icon images are all requested from `/icons/core_words/{id}.png`** regardless of the
  real category or extension, which is why the board has a two-letter text fallback. All 17
  hawker icons happen to exist at that path, so it works for the one scenario that ships.
- Other README overclaims listed in `sabi-evidence.md` section 6: MediaPipe overlay as shipped,
  `request_id` polling, a 500ms capture interval (it is 1000ms), three personas (there are five).

## Operational

- **AI Gateway — RESOLVED in Phase 5.** The 403 is gone. Production carries no
  `SABI_MODEL_PROVIDER`, no `ANTHROPIC_API_KEY` and no `AI_GATEWAY_API_KEY`, so it already took the
  default gateway path via OIDC; every figure in `MEASUREMENTS.md` came through it. On a streaming
  request the gateway returns `cost`, `generationId` and the input/output cost split inline in the
  final chunk, so no `getGenerationInfo` round trip is needed. The env var stays as an escape
  hatch.
- **Vercel preview URLs sit behind SSO.** The production alias is public, but branch and PR
  previews hit a Vercel login wall, which cuts against the plan's "no auth wall" goal. Untouched
  so far because it is a project security setting. Confirmed in Phase 5: the alias returns 200 with
  no auth markers, a per-deployment URL 302s to the login wall. The bench therefore targets the
  alias, never a deployment URL.
- **NPC sprites — MEASURED in Phase 5, and deliberately NOT compressed.** `next/image` delivers
  `happy.png` at 103,196 bytes of webp against a 2,574,362 byte source: a 96% reduction that is
  already happening. Compressing the sources would save the learner nothing and would shrink only
  the deploy upload; v1's copies are byte-identical and frozen, so the repo does not shrink either.
  This note assumed a cost that delivery optimisation had already removed.

## Surfaced by Phase 2, deferred on purpose

- **Structured output costs roughly 200-500ms of TTFT.** Median TTFT over four passes of ten real
  turns ranged 1650-1949ms against Phase 1's 1449ms baseline, and the spread is dominated by
  run-to-run variance rather than by the change. Reversing the schema field order to put `reply`
  first was measured and did NOT recover it (1925ms median, plus a marker miss), so the ordering
  stays as it is. Phase 5 measures this properly; treat the numbers here as indicative.

- **The scoring rubric penalised absence of opportunity — RESOLVED in Phase 4.** `strategic` is
  now nullable and nothing else is: it is the only dimension that needs an *opportunity* (a
  breakdown) before it can be observed at all, while the other four are visible on every turn the
  learner takes. The rubric returns null if and only if nothing in the transcript ever gave the
  learner something to repair, and it is pointed at the evidence already in the log — `NPC
  (confused)` is the NPC reporting that it did not understand.

  It was never just `strong-03`. Strategic was the only dimension where strong fixtures fell into
  the weak band, across the board. Re-running the suite on the corrected rubric moved far more than
  that one cell: tier separation improved (strong-mixed 12.8 -> 15.5), `strong-04` went 58 -> 65 and
  back inside its own label without anyone retiering the fixture, and strategic ROSE where a
  breakdown genuinely had occurred (`strong-02` 48 -> 71, `mixed-03` 32 -> 78) — the conflation had
  been depressing the dimension everywhere, not only where there was no opportunity.

  The model was already producing the concept in prose and being forced to encode it as a near-zero:
  `strong-03`'s own summary read *"strategic repair skills were not observed, as the interaction
  proceeded without misunderstandings"*. Unprompted, it now declines the dimension on exactly the
  three fixtures whose transcripts contain no `confused` turn (`strong-03`, `strong-04`, `mixed-02`);
  only one of the three is asserted, so the other two are unforced agreement. The eval asserts both
  halves — `strong-03` must decline it and `mixed-01`/`weak-02` must still score it low — because
  asserting only the first half would let "not observed" become a way out of every hard judgement.

- **Two eval fixtures are arguably mis-tiered, and they were left alone.** `strong-04` (articulate
  but rude) scores 58 and `mixed-01` (polite but never repairs) scores 42, so both sit outside the
  band their label claims. The aggregate tier separation still passes comfortably. Retiering them
  to match the model's output would be tuning the test to the answer, which is the exact failure
  mode the eval set exists to prevent. Recorded rather than fixed.

- **Gateway errors arrive with their marker symbol stripped.** `GatewayError.isInstance` returns
  false for the error an invalid `AI_GATEWAY_API_KEY` actually produces; it is a plain `Error` with
  `name: 'GatewayError'` and no statusCode. The classifier matches on the name as a result, which
  is brittle against an SDK upgrade. The tests pin the behaviour, so an upgrade that changes it
  fails loudly rather than silently.

- **`2.3` — RESOLVED in Phase 3.** The dead MediaPipe overlay is replaced by a live client-side
  pipeline. `@mediapipe/tasks-vision` Face Landmarker runs at 1fps on the CPU delegate, 52 ARKit
  blendshapes reduce to ten named signals (`v2/src/lib/expression/signals.ts`), and the per-turn
  window is summarised arithmetically into the `OBSERVABLE EXPRESSION` line of the system prompt.
  Verified end to end on the production build: the composed prompt carried
  `appears relaxed. (smile 0.93 -> 0.93, brow tension 0.38 -> 0.4, eyes narrowed 0.39 -> 0.39,
  over 11s across 12 samples)` and the model labelled the learner `content`. Both the submit path
  and the NPC-bump path carry a window.

- **`is_repair` — DECIDED in Phase 4: not added, and the reason is the interesting part.** The
  signal v1's flag tried to carry is already in the log, model-provided, once per turn: the NPC's
  own emotion, where `confused` is precisely "I did not understand you". A second per-turn boolean
  derived by any other means would repeat `2.9` on a therapist-facing field. The scoring rubric now
  reads that existing signal instead — see the not-observed band below — and the report prints the
  NPC's emotion beside each of its lines, so a reader can see where the breakdowns were without
  anything having to assert that a repair occurred.

- **Emotion taxonomies — RESOLVED in Phase 3, and there were four, not three.** Two remain and
  they describe different subjects: six NPC sprite labels (the character's feeling) and the twelve
  from v1's `/summarize-emotion` (the learner's, now a zod enum the model must satisfy — v1
  interpolated whatever string came back straight into the next system prompt). DeepFace's seven
  are retired with `expression-service/`; nothing in v2 emits them. The eight
  `EXPRESSION_DESCRIPTORS` are deliberately not a third set: they name muscle activity, not
  feeling, which is why they can be computed arithmetically without repeating `2.9`.
  The fourth set the BACKLOG missed is the AAC board's own `emotions` category (32 labels,
  `AACBoard.tsx:129-160`), which is learner *vocabulary* rather than learner *state*. Left alone,
  noted for Phase 6 along with the `angry`/`mad` and `surprise`/`surprised` collisions across sets.

- **Per-frame emotion samples are still not persisted, and Phase 4 confirmed they are not needed.**
  The report's timeline is per turn by design, and the per-turn record carries strictly more than
  v1's share chart did: the descriptor, the model's label, the intensity, the arc the signals
  traced, and the sample count, on a real clock from `session_events.created_at`. A verified
  session rendered twelve readings of the form `appears relaxed / content / turn 11 · 241s / smile
  0.74 -> 0.78, eyes wide 0.2 -> 0.17, inner brow raised 0.17 -> 0.14, over 14s across 15 samples`.
  v1 stored `session_offset_ms` on every 1fps row and never read it, so it could say what the
  learner mostly looked like and never when they were struggling. No `emotion_events` table, and
  no migration for one.

## Surfaced by Phase 3, deferred on purpose

- **A failed session start cannot be retried — FIXED in Phase 4, first thing.** `TurnState` gained
  a monotonic `effectSeq`, incremented in `enqueue`, which is the single place any effect is
  created; the id is now `${kind}#${seq}`. Uniqueness became structural rather than incidental, the
  reducer stayed pure, and `use-turn.ts` needed no change at all, so the StrictMode guarantee
  `startedEffects` exists for is untouched. The same fix closes the identically-shaped hang on a
  dialogue turn that failed before the stream opened. Two reducer tests pin it, and both were
  confirmed to FAIL against the old id scheme before the fix went in. The original diagnosis,
  unchanged:

  **Phase 1 defect, found by review in Phase 3, not fixed there because it was outside that phase.** `startedEffects` in `use-turn.ts:25` is a `Set` that is
  never pruned, and `effectId` (`reducer.ts:55-56`) is
  `${kind}:${turnIndex}:${transcript.length}:${pending.length}`. `SESSION_FAILED`
  (`reducer.ts:115-116`) returns to `lobby` without touching any of those three counters, and
  `EFFECT_SETTLED` drains `pending` back to empty, so the state is numerically identical to the
  initial state. The next Start click therefore regenerates the id `createSession:0:0:0`, the
  drain at `use-turn.ts:137` filters it out as already-started, no fetch happens, and the phase
  sits at `submitting` forever with `busy` true and no error shown. Recovery is a page reload.

  Confirmed by running the reducer through `START_REQUESTED` -> `SESSION_FAILED` ->
  `EFFECT_SETTLED` -> `START_REQUESTED`: both attempts produce `createSession:0:0:0`. Deterministic,
  not a race. It bites after any network blip on the very first request of a session, which is
  exactly when a reader of the deployed demo would meet it. Worth fixing early in Phase 4.


- **The emotion loop costs no measurable TTFT.** Two interleaved passes of 12 turn-pairs against
  the production build, same session shape, alternating which arm went first: median 2154ms and
  2115ms with an expression window, 2191ms and 2125ms without. The difference is noise and it is
  not in the direction of a regression. Absolute numbers are higher than the 1650-1949ms in the
  Phase 2 note because these were taken against a local `next start` on the direct Anthropic key
  rather than the deployed build; only the within-run comparison means anything. Phase 5 measures
  properly.

  The reason there is nothing to pay for: the summary is not a second model call. v1 awaited
  `POST /summarize-emotion` before `streamDialogue` could begin, on every turn
  (`session/page.tsx:554-558`). v2 composes the observation arithmetically server-side and asks
  for the label as one extra enum field in the dialogue call that was already happening — the same
  move Phase 2 made for `2.9`.

- **Per-frame emotion samples are not persisted, and there is no `0003` migration.** v1 wrote one
  `emotion_events` row per second and the only consumer ever built counted them into
  `"neutral 62%, happy 21%"` (`therapist/sessions/[sessionId]/page.tsx:88-96`). v2 stores the
  per-turn aggregate in the existing `npc_response` jsonb payload instead, which is what both
  consumers (the report and the scoring prompt) actually want. If Phase 4's emotion timeline turns
  out to need 1fps granularity, that is a migration plus a write path, decided with the report
  design in hand rather than speculatively.

- **`learnerEmotion` is `nullish`, not `nullable`, and that is a deliberate asymmetry.** A model
  that omits the label produces a turn with no emotion record; a model that omits it under a
  strict schema would produce no turn at all. The reply is what the learner is waiting for and the
  label is a data point, so the schema declines to trade the first for the second. `emotion` (the
  NPC's own) stays required, because the sprite has to render something.

- **`video.play()` never settles when a camera opens but delivers no frames.** Found while driving
  a session against a virtual camera device: the track went `live` with correct 640x480 settings
  and `readyState` stayed at `HAVE_NOTHING` forever, leaving the badge on "Starting camera" with
  no way out. Both `play()` and the landmarker load are now bounded by `START_TIMEOUT_MS`, and a
  timeout closes the stream before it gives up rather than leaving the browser's recording
  indicator lit for a feature that has already failed.

- **iPad is still inferred, not measured.** The spike ran on an M-series Mac. There is no WebGL or
  WebGPU dependency (the CPU delegate measured *faster* than GPU, 8.4ms vs 10.4ms p50, because the
  model is small enough that texture upload dominates) and no cross-origin isolation is required,
  which was measured rather than assumed. But per-frame cost on a tablet has not been observed.
  Open the production alias on a real iPad before Phase 5 claims anything about it. The documented
  fallback if it fails is a server function for inference.

- **The MediaPipe wasm runtime is copied into `public/` at build time and gitignored;
  the 3.7MB `face_landmarker.task` is committed.** The model comes from a Google Cloud Storage URL
  rather than from the package, and a build that silently depends on a remote fetch is the thing
  this phase argues against. Both SIMD and nosimd builds are copied because the resolver picks
  between them at runtime and a missing one is a 404 mid-session, not a build error.

- **The ONNX/transformers.js path is not taken, with numbers attached.** The candidate was
  `Xenova/facial_emotions_image_detection` (ViT-base, the DeepFace-equivalent class). It measured
  p50 676ms/frame on q8/wasm
  and 35.8ms on q4f16/WebGPU, against 8.4ms for MediaPipe; 50-87MB of model against 3.76MB; and it
  brings no face detector, which matters more than it sounds. On the same portrait the classifier
  scored `happy 0.288` on the uncropped 640x480 frame and `happy 0.858` once the face was cropped
  to 224x224. v1 leaned on DeepFace's internal opencv detector for that crop and passed
  `enforce_detection=False` (`expression-service/main.py:65-70`), so a failed detection silently
  classified the whole room and every error path returned neutral at 100% (`:91-93`). Worth saying
  out loud: the "DeepFace's 7 classes" bar is lower than it sounds.


## Resolved by Phase 4

- **`S11` — RESOLVED.** `isSessionComplete` is gone. The NPC reports its own farewell as a
  schema-enforced boolean in the dialogue call that was already happening — the same move Phase 2
  made for `2.9` and Phase 3 made for the learner's emotion, now for the third time — and
  `FAREWELL_MARKERS` is deleted rather than retired in place, so there is no second, disagreeing
  source of truth. `sessionCompletion(farewell, turnIndex)` returns the REASON, not a boolean, and
  applies only the two rules that are genuinely policy: a floor so a session cannot end before the
  learner has had a conversation, and a cap so it cannot run forever.

  That is what finally lets `turn_cap` be written. It had sat in `END_REASONS` and in the 0001
  check constraint since Phase 1 with nothing producing it, because a capped session and a real
  farewell were indistinguishable to every consumer. Verified live: a driven session ran to the cap
  and the row carries `end_reason: turn_cap`, with the summary screen and the report both saying
  the conversation ran out of room rather than claiming the order was completed.

  Cost, measured the way Phase 3 measured the emotion loop — ten interleaved pairs, alternating
  which arm ran first: median TTFT 1319ms with the field and 1591ms without. The delta is negative,
  which is noise rather than a speedup (one arm carried outliers at 3105 and 2139ms, the other was
  tightly clustered). The field costs nothing measurable, and nothing in the direction of a
  regression. Phase 5 measures properly.

- **Two writers owned session termination, and they disagreed. Found while re-scoping Phase 4; not
  previously recorded.** `api/dialogue/route.ts` passed `status: 'completed'` into `commitTurn`,
  which set `status`/`end_reason`/`ended_at` inside the turn transaction. The client then POSTed
  `/end`, which called `requireSession()` with no `allowEnded`, saw an already-completed session,
  and returned **409** — silently, because `use-turn.ts:117` never checked the response. So on the
  farewell path, the *normal success path*, the `session_end` event was never appended, the persona
  metrics were never computed and `persona_classified` was never written. Only `hearts_exhausted`
  and `manual` produced a complete record.

  `commitTurn` no longer ends anything; `/end` is the single writer of termination. The dialogue
  route still reports completion on the wire so the client transitions and fires the end effect.

- **Scoring fires on session end, server-side.** `after()` from `next/server`, scheduled by the end
  route once the response has flushed and still inside the same invocation: the learner gets the
  report link with no wait behind a model call, the scoring happens even if they close the tab, and
  the paid call stays behind the httpOnly cookie even though the report it produces is public to
  read. One retry, and only for the kinds the taxonomy marks retryable — verified by a forced 404,
  which classified as non-retryable and correctly did not burn a second call.

  `saveCompetenceScores` is now conditional on `competence_scores is null`, closing the
  last-write-wins race the route's read-through idempotency check left open.

- **Open decision 3 — SETTLED with numbers. Haiku stays.** `scoringModel()` is its own constant
  rather than an alias of the dialogue model's, and `npm run eval -- --model=<id>` runs the whole
  suite against anything and stamps the id into the result file (it previously recorded only
  `gateway` / `anthropic direct`, so two runs were indistinguishable). Both runs are committed
  under `evals/results/` and both pass 25/25:

  | | Haiku 4.5 | Sonnet 5 |
  |---|---|---|
  | strong - mixed margin | 15.5 | 15.9 |
  | mixed - weak margin | 45.8 | 33.8 |
  | worst per-fixture sd | 2.6 | 4.6 |
  | "not observed" applied | 3/3 fixtures, every run | 1/3 consistently; split runs on the other two |
  | $/MTok in-out | 1 / 5 | 2 / 10, plus ~340 reasoning tokens a call |

  The larger model matched on the one margin that was close, was worse on the other two and on
  stability, and was *less* consistent on exactly the judgement this phase added — declining
  `strategic` on some runs of a transcript and scoring it on others. The honest answer to `2.22` is
  that the model was never the weak part of this call. The rubric was.

  One finding worth keeping from the comparison: Sonnet 5 runs adaptive thinking by default and
  spent 336 of the old 500-token output budget on reasoning before being cut off at
  `finishReason: 'length'`, which surfaced as `malformed_output` and, correctly, no score at all —
  Phase 2's taxonomy catching a model swap. `MAX_OUTPUT_TOKENS` is now 2000; a ceiling is not a
  spend, so it costs nothing on a model that does not think.

## Surfaced by Phase 4, deferred on purpose

- **A session abandoned between the last turn and the end POST stays `active` forever.** Making
  `/end` the single writer of termination means nothing marks a session finished if the tab dies
  first. The `abandoned` status exists in the 0001 schema for exactly this and nothing sets it. v1
  had the same gap and had built the machinery to detect it — `session:{id}:alive`, which nothing
  ever consumed (`session-service/index.js:567`). A reaper is a background job and is not Phase 4.
  Two such rows already exist from the Phase 4 browser runs.

- **The scoring retry is bounded by the invocation, not just by the error kind. Found in review.**
  `after()` runs inside the end route's `maxDuration` (60s), a model call is bounded at 30s, and
  `timeout` classifies as retryable directly (`ai/errors.ts:108`) rather than through
  `RETRYABLE_KINDS` — so two attempts plus the 1.5s delay came to 61.5s. The failure was not a lost
  retry: the invocation would be killed after `setScoringState(id, 'running')` and before any
  terminal write, leaving a row nothing would ever move and a public report saying "Scoring this
  session, reload in a few seconds" permanently. Exactly the lie 0003 exists to prevent, put back
  by the retry. Now gated on there being room for a whole second attempt
  (`shouldRetryScoring`, pure and tested at the boundary).

- **An unknown model id classifies as `stream_failed`, not `provider_rejected`.** Forcing a scoring
  failure with a nonexistent model produced `provider 404: model: claude-does-not-exist-9`, and
  `fromStatus` (`lib/ai/errors.ts:45-59`) has no 404 case, so it fell to the default. The report
  therefore told the reader "Reported cause: stream failed" for what is really a configuration
  error. Harmless — nothing was fabricated and the failure was loud — but the taxonomy could be
  sharper. Phase 2's file, so it goes here rather than into a Phase 4 diff.

- **`persona_classified` is computed on every session end and rendered nowhere.** The end route
  derives it from the event log and writes it to the row; the report does not show it. Adding it is
  one field read, but persona display is not in Phase 4's scope (transcript, emotion timeline,
  competence radar) and it would want its own explanation of what the five personas mean.

- **The report has no way to retry a failed score from the page.** Deliberate: the page is public
  and a retry button there would put a paid model call behind an unauthenticated URL. The session's
  own browser can still POST `/score`, which is cookie-gated, but nothing in the UI calls it. If
  failed scores turn out to be common in practice, the retry belongs on the summary screen where
  the cookie is, not on the report.

- **`npm run typecheck` cannot pass on a clean checkout, and the v2 CI job has never run.**
  `src/app/layout.tsx:16` uses `LayoutProps<"/">`, a global that only exists after `next typegen`
  has written `.next/types`, and `.next/` is gitignored. CI's `checks` job runs `npm ci` and then
  `npm run typecheck` *before* `npm run build`, so it would fail there on a Phase-0 line. It has
  not surfaced yet only because `v2-rebuild` is unpushed and `.github/workflows/v2.yml` has
  therefore never executed — `gh run list` shows nothing but v1's April runs.

  Phase 4's report page deliberately does NOT add to this: it declares
  `{ params: Promise<{ sessionId: string }> }` by hand, the way all six existing route handlers
  already do, rather than using the generated `PageProps`. Verified by deleting `.next/` and
  running typecheck — `layout.tsx` is the only remaining error.

  The fix is one line, `"pretypecheck": "next typegen"` in `v2/package.json`, matching the
  `predev`/`prebuild` scripts already there. Left undone because package-level config is not
  something to change unilaterally mid-phase, and because it must be verified against an actual CI
  run rather than locally. Do it before the first push.

- **iPad is still inferred, not measured.** Unchanged from Phase 3. Phase 4 added a server-rendered
  report page with no client JavaScript of its own, so it changes nothing about the tablet story.

## Resolved by Phase 5

- **`MEASUREMENTS.md` exists.** p50/p95 TTFT and time-to-complete-turn on the deployed app, tokens
  and cost per turn and per session, per-frame inference cost, and the method for each. The four
  BACKLOG entries that ended "Phase 5 measures properly" are discharged, and section 6 states
  plainly that the Phase 1-4 figures are not comparable to each other or to anything since.

- **CI had never run, and neither of its jobs would have passed.** Two separate defects, both found
  by pushing:
  - `npm run typecheck` failed on `layout.tsx:16` from a clean checkout, as BACKLOG predicted.
    Fixed with `"pretypecheck": "next typegen"`.
  - **The `v1-frozen` gate was itself broken.** `git fetch origin main --depth=0` aborts with
    "fatal: depth 0 is not a positive number", so the job exited 128 before reaching the diff. The
    gate enforcing the rebuild's one hard constraint had never evaluated it once. Both fixed; both
    jobs now pass.

- **A model_call row in `session_events` would have silently corrupted persona classification.**
  `sessionMetrics` pairs events by strict array adjacency, so any row between an `npc_response` and
  the following `icon_selection` erases every latency sample. `avgResponseLatencyMs` then falls back
  to 0, which the classifier reads as "very fast" rather than "unknown": a hesitant learner on a 25s
  think time stops being `shy_chick` ("needs confidence building") and becomes `curious_monkey`,
  reported at full confidence. Found while choosing where measurement data lives. It is why
  `model_calls` is its own table. `sessionMetrics` is now extracted to `lib/session/metrics.ts` and
  the assumption is pinned by tests, including one asserting `EVENT_TYPES` is unchanged.

- **`/api/judge` had no `maxDuration`** while making a model call bounded at 30s under a shorter
  platform default. A truncated judge call is a heart not charged, and it would have censored that
  route's own slow tail. Now 60, matching the other model routes.

- **Open decision 4 — session recording to Blob: DECLINED, with the reasoning recorded.** It costs
  storage and adds an orphan-write failure mode of exactly the shape of v1's `S10`, in a phase whose
  subject is measurement. v1's finding `2.7` was already "three ways to serve one video". The
  report's per-turn emotion timeline on a real clock from `session_events.created_at` carries more
  clinical signal than a recording would, and it already exists. Declining on a stated ground is a
  result; leaving it silent is not.

- **Where the v2 load test lives: `v2/bench/`, and the plan conflicted with the freeze.** The plan
  said "tests/locust kept; extended in Phase 5 to load-test v2", but `tests/` is on the v1-frozen
  path list, so extending it in place fails the gate. The locust file is untouched. Its
  `translation`-key defect is carried forward as a design rule instead: `bench/assert.ts` has no
  defaults and no fallbacks, and a shape it does not recognise stops the run.

- **"Delete or correct any surviving comment that asserts a number nobody measured" also conflicted
  with the freeze.** All six of v1's claims live in frozen paths. They are superseded in
  `MEASUREMENTS.md` section 7 rather than edited. v2's own three were corrected in place.

- **One of v2's own comments was wrong by 3.5x.** `constants.ts` claimed "~8ms of inference per
  frame ... under 1% of a core" from the Phase 3 spike. Measured on the deployed build: ~29ms p50,
  so nearer 3% of a core. The conclusion survives, the number did not. The Phase 3 spike's method
  was never written down, so this replaces it rather than refuting it.

- **The structured-output TTFT cost is isolated at last: 306ms at p50.** Not an A/B across two runs
  on different days, but the difference between the model's first token (696ms) and the first token
  a learner can see (1002ms), recorded on the same call. It sits inside Phase 2's estimated
  200-500ms range.

## Surfaced by Phase 5, deferred on purpose

- **Prompt caching is untried, and it is the obvious lever.** `cache_read_tokens` and
  `cache_write_tokens` were zero on all 42 measured calls. Input outweighs output roughly 27 to 1
  (mean 1152 in, 43 out) because the system prompt, the scenario and up to twelve turns of history
  are re-sent every turn. Nothing in this phase's scope, but it is where the cost is.

- **Every latency figure carries ~300ms of Pacific.** Functions run in `iad1` and the measurements
  were taken from Singapore. `POST /api/translate` — pure function, no I/O, no model — measures the
  transport at p50 293ms, so a client near the function would see roughly 1000ms rather than
  1317ms. Both numbers are real; neither is quotable without saying where the client was. A run
  from a US-East host would settle it.

- **No contended run has been taken.** Everything is `--concurrency=1`. The harness supports higher
  concurrency and writes a separate result file for it, deliberately, so a contended run can never
  be averaged into the headline numbers.

- **Per-frame cost was measured against a canvas-sourced stream, not a hardware webcam**, and only
  on an M-series Mac. Tablets remain unmeasured, unchanged from Phase 3 — but the mechanism is now
  device-agnostic and self-reporting, so opening the production alias on any device and playing one
  session lands the numbers in the database without further tooling.

- **The bench adds real sessions and real public reports to production.** Unavoidable without adding
  request surface, which this phase declines to do. Mitigated instead: every session id a run
  creates is written into its result file, so the rows are enumerable rather than anonymous.

- **Survival-mode cost is inferred, not observed.** `/api/judge` is instrumented, but no survival
  session appears in the committed run, so per-session cost for survival is extrapolated from the
  per-call figures.
