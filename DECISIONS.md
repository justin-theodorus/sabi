# Decisions

The before and after, as ADRs. Finding ids (`2.9`, `S5`, `3.1`) refer to the audit of v1 that
preceded the rebuild; numbers refer to [MEASUREMENTS.md](MEASUREMENTS.md).

Each record says what was decided, what the evidence was, and **what was lost**. The last column is
the one that matters: a decision with no cost is usually a decision that has not been examined.

---

## ADR-001: Collapse seven services into one Next.js app

**Status:** done. **Supersedes:** the entire v1 topology.

### Context

v1 shipped seven services, a Kong gateway, a BullMQ queue, Redis, MinIO and 905 lines of Kubernetes
for a four-week prototype with zero tests. The deployment target for the rebuild was Vercel, which
cannot host that topology.

### The evidence that it was wrong, independent of Vercel

This is the part that matters, because "it did not fit my host" is not an engineering argument.

- **The topology itself caused the three CRITICAL security findings.** `S1`, `S2` and `S3` are all
  the same root cause: auth would have had to be reimplemented in every service, so in four of them
  it simply was not. Four services were reachable through the gateway with no authentication at
  all. `GET /sessions/:id/video-stream` served webcam footage of children with no auth.
- **Concurrency was specified in four places with four different numbers** (`2.8`): a Python
  semaphore of 3 per process, a BullMQ ceiling of 6, a Kong limit of 120/min per IP with
  `policy: local` (which counts per Kong node, not globally), and a load-test docstring describing
  a Redis sliding window that does not exist anywhere in the codebase. At full scale-out the real
  figure was 8 pods times 3 = 24 concurrent Claude calls, against a comment three files away
  claiming a hard ceiling of 6.
- **The KEDA scaler names a trigger type that does not exist** (`S8`), so the queue's autoscaling
  could never have worked.
- **`dev.sh` runs a different topology than CI, compose and k8s do.** Four descriptions of one
  system, none authoritative.
- **The queue was in front of two of six model endpoints** (`2.19`), so the thing it existed to
  protect was only half protected.

The deployment constraint and the engineering fix pointed the same way. That is the whole argument.

### Decision

One Next.js app. Seven route handlers, one Postgres, no gateway, no queue, no Redis, no object
store, no containers.

### What was lost

- **Horizontal scaling as an explicit, inspectable artifact.** v1's k8s manifests state an intent
  about scale. v2 delegates it to the platform and cannot show you the policy.
- **Language choice per service.** The Python services are ported to TypeScript. `dialogue-engine`
  was 867 lines of which roughly 350 were prompt string constants that copied across verbatim, so
  this cost less than it sounds, but it is still a real constraint on future work.
- **The queue's back-pressure story.** v2 has no way to shed load other than the platform's.
- **Independent deployability.** In practice v1 never used it: one `docker-compose up` deployed
  everything, and `ci.yml` built all six images together.

### What was gained, measured

Time to first token, as the learner experiences it, on the deployed app: **p50 1317ms, p95 1649ms**
across 36 turns. Cost: **$0.0014 per turn, $0.0100 per scored session.** v1 has no comparable
number, because nothing in it was ever measured.

---

## ADR-002: Remove authentication entirely

**Status:** done. **Closes:** `S1`, `S2`, `S3`, `S4`, `S7`.

### Context

v1 had login, signup, a role picker, and authorization decided from `user_metadata`, a field the
user controls. Eight copy-pasted role checks, four services with none at all.

### Decision

No auth surface. An anonymous session on first load, an httpOnly cookie holding a UUIDv4, and a
public read-only `/report/[sessionId]`.

### Why this is a fix and not a shortcut

Patching eight role checks would leave the model intact, and the model was wrong at the root.
Deleting the surface closes `S1` to `S4` outright. `S7` (an N+1 over the auth admin API with no
bound) goes with the multi-learner dashboard that required auth to mean anything.

It is also the product argument: one uninterrupted flow demos both halves of the product with no
login wall between a reader and the thing.

### What was lost

- **Multi-learner therapist dashboards.** Gone, and they cannot come back without auth.
- **The session id is now the only capability.** If it leaks, the report leaks. It is unguessable
  and the page is `noindex`, but this is a real property of the design and not a detail.
- **Any notion of data ownership.** There is no user to own a session.

This is defensible for a demo and **not** defensible for a product handling clinical data about
children. That distinction belongs in this document rather than in a footnote.

---

## ADR-003: Ask the model, do not infer from its output

**Status:** done, four times. **Closes:** `2.9`, `S11`, and a per-turn model call.

### Context

v1 derived three separate signals by post-processing the NPC's finished prose:

- **NPC emotion** by keyword match, with branches ordered sad, confused, mad, surprised, happy. The
  `confused` branch matched the literal substring `"?"`. The system prompt instructs the NPC to
  "Ask only ONE thing at a time", so an NPC that ends nearly every turn with a question was
  nearly always classified confused. The sprite froze and the therapist-facing `is_repair` flag was
  near-constantly true.
- **Session completion** by searching for a scenario-specific farewell phrase. `queue_shop`'s list
  included "sorry" and "alright", words a defensive NPC says constantly and early. A scenario id
  outside the four-key dictionary got an empty list and **could never complete at all** (`S11`).
- **Learner emotion** by a second model call, `POST /summarize-emotion`, awaited before the dialogue
  stream could begin, on every turn.

### Decision

Ask for all three as schema-enforced fields in the dialogue call that is already happening.

### Evidence it worked

Over 40 real turns on the production build: 0 degenerate `confused` runs, 0/40 marker misses, and
every reply still ended in a question mark, which is the exact input that used to force `confused`.
`turn_cap` became writable for the first time, because a capped session and a real farewell had
been indistinguishable to every consumer.

### What it costs

306ms of learner-visible time to first token, measured per call as the difference between the
model's first token (696ms) and the first token a learner can see (1002ms). The short fields are
declared before `reply` so a truncated response still carries them, and that ordering is the cost.

That is a real price and it is worth paying: it buys the deletion of two whole classes of guessing,
and one of those classes could strand a session forever.

### What was lost

- **`is_repair` as an explicit per-turn boolean.** Deliberately not re-added: the signal it tried to
  carry is already in the log, model-provided, once per turn, as the NPC's own `confused` emotion.
  A second boolean derived by any other means would repeat `2.9` on a therapist-facing field.
- **A guarantee that the emotion label exists.** `learnerEmotion` is nullish, not nullable: a model
  that omits it produces a turn with no emotion record, where a strict schema would produce no turn
  at all. The reply is what the learner is waiting for; the label is a data point. The schema
  declines to trade the first for the second.

---

## ADR-004: Move emotion inference to the browser

**Status:** done. **Closes:** `2.3`. **Supersedes:** `expression-service`.

### Context

v1 POSTed a JPEG frame per second to a 2GB-RAM DeepFace service. A separate MediaPipe Face Mesh
overlay existed in the frontend, was advertised in the README as a shipped feature, and was
imported by nothing (`2.3`).

### Decision

MediaPipe Face Landmarker in the browser, CPU delegate, 1 Hz. 52 blendshapes reduce to ten named
signals, summarised arithmetically server-side into one line of the system prompt.

### The alternative, with numbers

`Xenova/facial_emotions_image_detection` (ViT-base, the DeepFace-equivalent class) was measured and
rejected: p50 676ms/frame on q8/wasm against MediaPipe's single-digit-to-30ms, 50-87MB of model
against 3.76MB, and **no face detector of its own**, which matters more than it sounds. On the same
portrait it scored `happy 0.288` on the uncropped 640x480 frame and `happy 0.858` once the face was
cropped. v1 leaned on DeepFace's internal detector for that crop and passed
`enforce_detection=False`, so a failed detection silently classified the whole room, and every error
path returned neutral at 100%.

Worth saying plainly: **the "DeepFace's 7 classes" bar is lower than it sounds.**

### The architecture answer this produces

Webcam frames of children with disabilities never leave the device. Ten floats per second do. That
is a better story than "I called DeepFace", and it is true.

### What was lost

- **Server-side control of the model.** Inference quality now depends on the learner's device.
- **Per-frame history.** v2 stores a per-turn aggregate, not a row per second. v1 wrote a row per
  second and the only consumer ever built counted them into "neutral 62%, happy 21%", so it could
  say what a learner mostly looked like and never *when* they were struggling. The per-turn record
  carries strictly more: descriptor, model label, intensity, the arc the signals traced, and a
  sample count, on a real clock.
- **7.0MB of assets** the browser must fetch, of which 3.76MB is a committed model file.

### Correction to an earlier claim in this repository

A comment in `lib/turn/constants.ts` said "~8ms of inference per frame, under 1% of a core",
inherited from the spike. Measured on the deployed build across 81 frames it is **~29ms p50**, so
nearer 3% of a core. The decision survives unchanged; the number did not. The spike's method was
never written down, which is precisely why it could not be checked.

---

## ADR-005: Enforce the scoring schema, and record no score when it fails

**Status:** done. **Closes:** the fabricated-score half of section 5 of the audit.

### Context

v1 asked Claude for JSON, stripped markdown fences with ``raw.startswith("```")``, and defaulted every
missing dimension with `float(scores.get(k, 50))`. A malformed response silently produced a
plausible mid-range **clinical** score for a child.

### Decision

Structured output with a zod schema. A malformed response produces no score at all, recorded as
`scoring_state = 'failed'` with the classified error kind, and the public report says so.

### Supporting decisions

- **An eval set exists.** Ten hand-scored transcripts spanning clearly-good, clearly-poor and
  ambiguous sessions, three runs each, 25 assertions on tier *ordering* and dimension separation
  rather than on exact values. Results are committed.
- **Two fixtures are arguably mis-tiered and were left alone.** `strong-04` (articulate but rude)
  scores 58; `mixed-01` (polite but never repairs) scores 42. Retiering them to match the model's
  output would be tuning the test to the answer, which is the exact failure mode an eval set exists
  to prevent. Recorded rather than fixed.
- **The rubric was wrong, not the model.** `strategic` used to punish a session in which nothing
  went wrong. It is now nullable, returning null if and only if nothing in the transcript ever gave
  the learner something to repair. Fixing that moved the numbers far more than changing the model
  did: tier separation improved, and `strategic` *rose* where a breakdown genuinely had occurred
  (`strong-02` 48 to 71, `mixed-03` 32 to 78).

### What was lost

Sessions can now end with no score. That is the point, but it is a real regression in apparent
completeness, and the public report has to be able to say "scoring failed" out loud.

The report also has **no retry affordance**, deliberately: the page is public, and a retry button
there would put a paid model call behind an unauthenticated URL.

---

## ADR-006: Measurement data gets its own table, not a seventh event type

**Status:** done. **Migration:** `0004_model_calls.sql`.

### Context

Phase 5 needed tokens, cost and latency per turn and per session. The obvious home was a new
`session_events` type, matching the existing log.

### Why that would have been a silent disaster

`sessionMetrics` derives learner think time by **array adjacency**: a gap counts only when
`events[i]` is an `icon_selection` and `events[i-1]` is an `npc_response`. A measurement row lands
exactly between those two.

Every latency sample would vanish. `avgResponseLatencyMs` falls back to 0, which the persona
classifier does not read as "unknown" but as "very fast". A hesitant learner on a 25-second think
time stops being `shy_chick`, "needs confidence building", and becomes `curious_monkey`,
"exploratory and flexible", reported at full confidence, with nothing raised anywhere.

Three further reasons, any one sufficient: `seq` is derived inside `commitTurn`'s transaction and
`appendEvent` races it by design; scoring runs in `after()`, where a row would land past the
terminal `session_end` event; and `/report/[sessionId]` is public and walks the event log, while
cost and generation ids are operator data.

### Decision

A separate `model_calls` table. `cost_usd` is `numeric(12,8)`, not a float, because these are
fractions of a cent summed across a session and then published as a dollar figure. **Null is
distinct from zero throughout**: a cost that could not be read and a free call are different facts.

`sessionMetrics` was extracted out of the route file so it can be tested, and the adjacency
assumption is now pinned by a characterisation test, including one that fails if `EVENT_TYPES`
changes at all.

### What was lost

One more table, and per-turn cost is no longer readable from the event log alone.

---

## ADR-007: Decline session recording to Blob

**Status:** decided, not built.

### Context

The rebuild plan left this open for the measurement phase to settle.

### Decision

Declined.

### Reasoning

- It adds a storage integration and an orphan-write failure mode of exactly the shape of finding
  `S10`: the object write succeeds, the pointer write fails, and the object is orphaned forever.
- v1's finding `2.7` was already "three ways to serve one video", of which the one actually in use
  buffered the entire WebM into browser memory before the first frame played, deliberately
  bypassing the Range implementation written for it.
- The report's per-turn emotion timeline, on a real clock from `session_events.created_at`, carries
  more clinical signal than a recording would, and it already exists.
- It adds a privacy surface to a system whose load-bearing claim is that webcam frames of children
  never leave the device.

### What was lost

Therapists cannot watch a session back. That was a real v1 feature and its absence is a genuine
product regression, not a cleanup.

**Declining an optional item on a stated ground is a result. Leaving it silent is not.**

---

## ADR-008: The v2 load test lives in `v2/bench/`, and the plan conflicted with the freeze

**Status:** done.

### Context

The rebuild plan said "`tests/locust` kept; extended in Phase 5 to load-test v2". But `tests/` is on
the v1-frozen path list in `.github/workflows/v2.yml`, so extending it in place fails the gate that
protects the rebuild's one hard constraint.

### Decision

A new harness under `v2/bench/`. `tests/locust` is untouched, defect included.

### The defect, carried forward as a design rule

`tests/locust/locustfile.py:276` reads a `translation` key from `/translate`. Neither
`aac-icon-service` nor v2's `/api/translate` has ever returned that key; both return `{ text }`. So
the expression silently fell back to `" ".join(icons)` on **every run ever made**. The translate leg
was timed and its output discarded, and nothing said so.

`v2/bench/assert.ts` therefore has no defaults and no optional-chained fallbacks. Every field it
reads is asserted and every failure names what it found instead. A shape it does not recognise stops
the run rather than quietly becoming a fiction. The session-create assertion doubles as a
stale-deploy detector.

### Two more things the same conflict surfaced

- **"Delete or correct any surviving comment that asserts a number nobody measured"** cannot mean
  what it says: all six of v1's unverifiable claims sit in frozen paths. They are superseded in
  MEASUREMENTS.md section 7 instead. v2's own three were corrected in place.
- **The freeze gate had never run.** `git fetch origin main --depth=0` aborts with "fatal: depth 0
  is not a positive number", so the job exited 128 before reaching its diff. The gate enforcing the
  rebuild's one hard constraint had never evaluated it once, invisible because the branch was
  unpushed. Found on the first real CI run, and fixed.

---

## ADR-009: Scope cut to one scenario

**Status:** done.

### Decision

`hawker_centre` only. The scenario builder, the other three scenarios, the learner progress screen,
the multi-learner dashboard, login/signup, and video recording are all out.

### Reasoning

| Cut | Why |
|---|---|
| Scenario builder | Two incompatible write paths (`2.5`) and the `npc_path` column overloaded to also store an unrelated setting (`2.1`), which produced three layered workarounds in three files. Cutting it deletes the bug rather than fixing it |
| Other three scenarios | No backgrounds and no NPC sprites (`2.11`). Either commission art or stay single-scenario |
| Learner progress screen | Entirely fabricated data: three hardcoded arrays behind TODOs |
| Multi-learner dashboard | Requires auth to mean anything; see ADR-002 |

### What was lost

Breadth, and it shows. A reader sees one scenario. The judgement is that one scenario done properly
is a stronger showcase than four done thinly, but it is a judgement and not a fact.

---

## Still open

Carried in [BACKLOG.md](BACKLOG.md) rather than decided here.

- **A session abandoned between the last turn and the end POST stays `active` forever.** The
  `abandoned` status exists in the schema and nothing sets it. v1 had the same gap and had built the
  detector it never consumed (`session:{id}:alive`). A reaper is a background job.
- **Prompt caching is untried**, and it is the clearest available lever: zero cache reads on all 42
  measured calls, with input outweighing output roughly 27 to 1.
- **An unknown model id classifies as `stream_failed` rather than `provider_rejected`**, because
  `fromStatus` has no 404 case. Harmless, nothing is fabricated, but the report tells a reader
  "stream failed" for what is really a configuration error.
- **`persona_classified` is computed on every session end and rendered nowhere.**
- **Tablets are unmeasured.** The mechanism is now device-agnostic and self-reporting, so opening
  the deployed app on one and playing a session is sufficient to close it.
