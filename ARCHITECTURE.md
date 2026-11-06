# Architecture

What SABI is now, and why it is shaped this way. The before/after and the reasoning behind each
change are in [DECISIONS.md](DECISIONS.md); the numbers are in [MEASUREMENTS.md](MEASUREMENTS.md).

This repository holds two complete systems. **v2** is the one that runs at
<https://sabi-lyart.vercel.app>. **v1** is the seven-service build it replaced, kept in the working
tree, still runnable, and deliberately not deleted. Section 4 explains why.

---

## 1. v2: one Next.js app

```
Browser (Next.js App Router, React 19)
  |
  |  MediaPipe Face Landmarker runs here, at 1 Hz.
  |  Webcam frames never leave the device. Ten numbers per second do.
  |
  +-- POST /api/sessions               create an anonymous session, set an httpOnly cookie
  +-- POST /api/sessions/[id]/events   append a client-originated event (hearts, scenario events)
  +-- POST /api/sessions/[id]/end      terminate, then score in after()
  +-- POST /api/sessions/[id]/score    retry a failed score, cookie-gated
  +-- POST /api/translate              icons to a sentence; pure function, no I/O
  +-- POST /api/dialogue    --AI SDK-->  AI Gateway --> Claude Haiku 4.5   (streamed)
  +-- POST /api/judge       --AI SDK-->  AI Gateway --> Claude Haiku 4.5   (survival mode)
       |
       +--> Neon Postgres     sessions, session_events, model_calls
       |
       +--> GET /report/[sessionId]    public, no cookie, server-rendered, noindex
```

Seven route handlers, one database, no gateway, no queue, no Redis, no object store, no Python, no
containers. Vercel's project root is `v2/`.

### The shape of a turn

1. The learner taps icons. A reducer (`lib/turn/reducer.ts`) owns all state; it is pure, with no
   `Date.now()`, no I/O and no React. Every side effect is an `Effect` object it enqueues.
2. `lib/turn/use-turn.ts` drains that queue. This is the only place the client does I/O.
3. `POST /api/dialogue` translates the icons in-process, loads a capped history, composes the
   system prompt, and calls `streamText` with a zod schema as `Output.object`.
4. The reply streams back as an AI SDK UI message stream. The client reads it with
   `readTurnStream`, the same function the bench harness uses.
5. When the model finishes, `onReply` commits the turn: the icon selection, the NPC response and
   the turn index, in **one transaction**.
6. `onMeasured` then records what the call cost into `model_calls`, after the last meaningful byte,
   so a measurement write can never delay a reply.

### Four things the model is asked for in one call

The dialogue schema (`lib/dialogue/npc-reply.ts`) is the single most load-bearing design decision
in v2, and it is the same move made four times:

| field | replaces | v1's version |
|---|---|---|
| `emotion` | keyword-matching the NPC's own reply | `detect_npc_emotion`, whose `?` branch fired before `!`, so an NPC told to ask one question per turn was almost always "confused" (finding `2.9`) |
| `learnerEmotion` | a second model call before every turn | `POST /summarize-emotion`, awaited before `streamDialogue` could begin (`session/page.tsx:554-558`) |
| `farewell` | substring-searching the finished prose | `FAREWELL_MARKERS`, whose `queue_shop` list contained "sorry" and "alright", and whose unknown-scenario path could never complete at all (finding `S11`) |
| `reply` | - | - |

The principle: **the model already knows these things, so ask it in the call that is already
happening rather than inferring them from its output afterwards.** Three separate v1 defects
collapse into one schema.

The short fields are declared before `reply` on purpose, so a response truncated by the 256-token
cap still carries them. That ordering costs 306ms of learner-visible time-to-first-token, measured
per call rather than estimated; see MEASUREMENTS.md section 2.4.

### State

Server-side, in Postgres, keyed by an anonymous session id in an httpOnly cookie. Not
`sessionStorage`, which in v1 held the scenario and produced finding `3.2`. The event log is
append-only with a `seq` derived inside the writing transaction, and `unique (session_id, seq)`
makes a duplicate turn structurally impossible rather than merely unlikely.

One consequence worth stating because it is invisible at the call site: **`sessionMetrics` reads
learner think time by array adjacency**, so any new event type inserted between an `npc_response`
and the following `icon_selection` silently erases every latency sample. That is why measurement
data lives in its own `model_calls` table rather than becoming a seventh event type. The assumption
is pinned by tests in `lib/session/metrics.test.ts`.

### Emotion, on the device

`@mediapipe/tasks-vision` Face Landmarker, CPU delegate, 1 Hz. 52 ARKit blendshapes reduce to ten
named signals (`lib/expression/signals.ts`), and a window of samples is summarised **arithmetically**
server-side into one `OBSERVABLE EXPRESSION` line of the system prompt. No second model call.

The summary describes a *progression*, not a point sample: "what did their face do while composing
this" rather than "what is their face doing now". That idea is kept verbatim from v1, which had it
right; what changed is where the inference runs and what it costs.

The descriptors it emits ("relaxed", "tense", "focused") name muscle activity, not feeling.
Calling an arithmetic result "angry" is exactly what finding `2.9` punishes; calling it "tense" is
a description of a face, and the interpretation is left to the model reading the prompt.

### Scoring

`POST /api/sessions/[id]/end` is the **sole writer of session termination**, and schedules scoring
via `after()` from `next/server`. The learner gets the report link with no wait behind a model
call; the scoring happens even if they close the tab; and the paid call stays behind the httpOnly
cookie even though the report it produces is public to read.

`after()` runs inside the route's `maxDuration`, so the single retry is gated on there being room
for a whole second attempt (`shouldRetryScoring`, pure and tested at the boundary). Without that
gate a retry can outlive the invocation and strand a row at `scoring_state = 'running'` forever,
which is the exact lie the `scoring_state` column exists to prevent.

Output is schema-enforced. A malformed response produces **no score at all**, recorded as
`scoring_state = 'failed'` with the classified error kind. v1 caught the parse failure and filled
the gaps with `float(scores.get(k, 50))` five times over, so a broken model response became a
plausible mid-range clinical score.

`strategic` is the one nullable dimension. It is the only one that needs an *opportunity* (a
communication breakdown) before it can be observed at all; the other four are visible on every turn.

### No authentication

Deliberate, and a security fix rather than a demo convenience. Deleting the auth surface closes
findings `S1` through `S4` outright rather than patching eight copy-pasted role checks built on a
model that was wrong at the root: v1 read authorization from `user_metadata`, which the user
controls.

The replacement is an anonymous session on first load and a public read-only `/report/[sessionId]`.
Session ids are UUIDv4 and are the only capability, so they must stay unguessable. This is the same
argument `session-service/index.js:789` made and failed to hold, because there the UUID was also
embedded in client-readable rows.

### Error handling

Ten categories in `lib/ai/errors.ts`, each with defined learner-facing copy in
`lib/turn/error-messages.ts`, and **none of them costs a heart**. v1 handled one error class
(`anthropic.RateLimitError`) at two of six call sites (finding `S5`).

The classifier matches gateway errors partly by `name` string, because an invalid gateway key
arrives as a plain `Error` with no marker symbol and no status code. That is brittle against an SDK
upgrade, so the tests pin it: an upgrade that changes it fails loudly rather than silently.

---

## 2. What is tested, and how it is known to work

| | |
|---|---|
| Unit and integration tests | **323**, `node:test` through `tsx`, all offline against mock providers |
| Scoring evals | 10 hand-scored transcripts, 3 runs each, 25 assertions, real model calls, `workflow_dispatch` only |
| Latency and cost bench | `v2/bench/`, drives the deployed app over real HTTP, no CI trigger at all |
| CI | typecheck, lint, test, build, plus a job that fails if any v1 file has changed |

v1 had zero tests of any kind. Its CI type-checked the frontend, ran `ruff` over three hardcoded
file paths, built six images, and curled `/health` with `ANTHROPIC_API_KEY=stub`, which means no
model code path was exercised anywhere.

Three constraints shape where code lives:

- The test runner matches `src/**/*.test.ts` only. Not `.tsx`, and there is no React test renderer.
  So anything that needs asserting goes in a pure `lib/**/*.ts` module and the component stays a
  thin shell over it. `lib/report/radar.ts` and `lib/expression/frame-cost.ts` exist for this reason.
- `evals/` and `bench/` sit **outside** `src/`, so `npm test` cannot reach them and an ordinary push
  can never spend money.
- Every commit typechecks and is test-green on its own, verified in a worktree, so `git bisect`
  works across the rebuild.

---

## 3. v1: seven services, as built

Still in the working tree. `docker compose up` brings all eleven containers up, verified rather
than assumed.

```
Frontend (Next.js 14) :3000
        |
   Kong Gateway :8000
        |
   +----+--------+---------------+------------------+
   |             |               |                  |
dialogue-queue  session-service  persona-engine  aac-icon-service
   :8006          :8004            :8002            :8005
   |
dialogue-engine :8001 (internal)
   |
expression-service :8003 (DeepFace)
   |
Redis :6379     MinIO :9000     Supabase (hosted Postgres + Auth)
```

| Service | Lines | Language |
|---|---|---|
| `dialogue-engine` | 867 | Python / FastAPI |
| `session-service` | 891 | Node / Express |
| `dialogue-queue` | 197 | Node / BullMQ |
| `persona-engine` | 136 | Python / FastAPI |
| `expression-service` | 94 | Python / DeepFace |
| `aac-icon-service` | 86 | Node / Express |
| `k8s/` | 905 | YAML |
| `kong/` | 143 | YAML |
| `tests/locust/` | 353 | Python |
| `frontend/src` | 7,906 | TypeScript |

Roughly 3,700 lines of backend, gateway and infrastructure.

---

## 4. Why v1 is still here

Because nobody runs `git log` on a stranger's repository.

The seven-service build is the largest body of uncontested solo work in this project, and the
rebuild's argument depends on it being inspectable. "I built it as seven services, here is the
specific evidence that was wrong, here is what I collapsed it to, and here is what I measured
afterward" is only checkable if the seven services are there to check.

It is also frozen as a **gate rather than a promise**: `.github/workflows/v2.yml` fails if
`git diff origin/main...HEAD` over the v1 paths returns anything. That gate was itself broken until
Phase 5 first pushed and found it exiting 128 before it ever ran its diff.

The cost is a repository root containing two Next.js applications. That is a fair description of
what this project is.

**v1 was not moved into a `v1/` folder**, because moving it means editing it: `docker-compose.yml`
has eight build contexts pointing at `./dialogue-engine` and its siblings, `ci.yml` hardcodes
working directories, `dev.sh` loops with `cd "$service"`, and `session-service/index.js:1-2` loads
`../.env.local` by relative path. A restructure breaks several of those, and fixing v1 to make the
move work would contradict freezing it.

---

## 5. Stack

| | |
|---|---|
| Framework | Next.js 16.3.5 (App Router), React 19.2.8 |
| Model calls | Vercel AI SDK 7, through the Vercel AI Gateway, authenticated by OIDC on Vercel |
| Model | `anthropic/claude-haiku-4.5` for dialogue, judge and scoring alike |
| Database | Neon Postgres. HTTP driver on the request path (one statement per call); WebSocket driver for migrations |
| Emotion | `@mediapipe/tasks-vision` Face Landmarker, CPU delegate, in the browser |
| Hosting | Vercel, functions in `iad1` |
| Auth | None, deliberately |

**Why Haiku for scoring too.** Settled with evidence rather than intuition: the eval suite was run
against Sonnet 5 and the results are committed under `v2/evals/results/`. Both pass 25/25. Sonnet
matched Haiku on the one margin that was close, was worse on the other two and on run-to-run
stability, and was *less* consistent on the "not observed" judgement. The honest conclusion for
finding `2.22` is that the model was never the weak part of that call. The rubric was.
