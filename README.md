# SABI

AI-powered communication training for AAC users. A learner taps pictogram icons to build a
sentence; an LLM plays a hawker stall uncle who responds in character, adapts to how the learner is
communicating, and reacts to what their face is doing. When the session ends, a public link shows
the transcript, an emotion timeline and a communication competence score.

**Live: <https://sabi-lyart.vercel.app>**. No sign-in, by design.

---

## This repository contains two systems

| | |
|---|---|
| **`v2/`** | One Next.js app on Vercel. This is what runs at the URL above. |
| everything else | **v1**: seven services, a Kong gateway, a BullMQ queue, Redis, MinIO and 905 lines of Kubernetes. Frozen, still runnable with `docker compose up`, and deliberately not deleted. |

v2 is a rebuild of v1, not a new project. It was preceded by a line-by-line audit of v1 that found
three CRITICAL security defects, four disagreeing concurrency limits, six performance claims that
nobody had ever measured, and zero tests. The rebuild is additive: no v1 file is moved, renamed or
edited, and CI fails if one changes.

**Read [DECISIONS.md](DECISIONS.md) for what changed and why, [ARCHITECTURE.md](ARCHITECTURE.md)
for how v2 works, and [MEASUREMENTS.md](MEASUREMENTS.md) for the numbers.**

---

## What v2 does

- One scenario: ordering food at a Singapore hawker centre.
- An AAC board of 128 icons across three categories, plus scenario-specific items.
- Learning mode and Survival mode. Survival adds hearts, a 30-second timer, and an off-context
  check that can cost a heart.
- Streamed NPC dialogue with the NPC's own emotion driving its sprite.
- Client-side facial expression capture at 1 Hz. **Frames never leave the device**; ten numbers per
  second do, and they are summarised into one line of the model's prompt.
- A public session report: transcript, per-turn emotion timeline, competence radar.

### Measured, on the deployed app

| | |
|---|---|
| time to first token, as the learner sees it | p50 1317ms, p95 1649ms |
| time to complete a turn | p50 1454ms, p95 1803ms |
| cost | $0.0014 per turn, $0.0100 per scored session |
| on-device inference | ~29ms per frame at 1 Hz |

Method, sample sizes and caveats in [MEASUREMENTS.md](MEASUREMENTS.md). Roughly 300ms of each
latency figure is the Pacific: functions run in `iad1` and the measurements were taken from
Singapore.

---

## Running v2

```bash
cd v2
npm install
cp .env.local.example .env.local   # or: vercel env pull v2/.env.local --yes
npm run db:migrate
npm run dev
```

| command | what it does |
|---|---|
| `npm test` | 323 unit tests, offline, no model calls |
| `npm run typecheck` | runs `next typegen` first, then `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run eval` | scoring evals against a real model. **Costs money.** |
| `npm run bench -- --url=<url>` | latency bench against a deployed app. **Costs money.** |
| `npm run bench:cost` | reads tokens and cost back out of `model_calls` |

`evals/` and `bench/` sit outside `src/` on purpose, so `npm test` cannot reach them and an ordinary
push can never spend money.

### Environment

```env
DATABASE_URL=              # Neon Postgres
AI_GATEWAY_API_KEY=        # local only; on Vercel, OIDC authenticates the gateway
ANTHROPIC_API_KEY=         # only needed with SABI_MODEL_PROVIDER=anthropic
SABI_MODEL_PROVIDER=       # unset for the AI Gateway (default); 'anthropic' to bypass it
SABI_SCORING_MODEL=        # optional override, used by `npm run eval -- --model=<id>`
```

---

## Running v1

Still works. Eleven containers, verified rather than assumed.

```bash
cp .env.example .env      # ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, SUPABASE_*
node scripts/fetch-icons.js
docker compose up --build
```

| URL | |
|---|---|
| http://localhost:3000 | frontend |
| http://localhost:8000 | Kong gateway |
| http://localhost:9001 | MinIO console (`minioadmin` / `minioadmin`) |

### v1 services

| Service | Tech | Port | Lines |
|---|---|---|---|
| `frontend` | Next.js 14 | 3000 | 7,906 |
| `kong` | Kong 3.6 | 8000 | 143 |
| `dialogue-engine` | Python / FastAPI | 8001 (internal) | 867 |
| `persona-engine` | Python / FastAPI | 8002 | 136 |
| `expression-service` | Python / DeepFace | 8003 | 94 |
| `session-service` | Node / Express | 8004 | 891 |
| `aac-icon-service` | Node / Express | 8005 | 86 |
| `dialogue-queue` | Node / BullMQ | 8006 | 197 |
| `redis` | Redis 7 | 6379 | |
| `minio` | MinIO | 9000/9001 | |
| `k8s/` | manifests, never deployed | | 905 |

Supabase hosts v1's Postgres and auth. Tables: `sessions`, `session_events`, `emotion_events`,
`learner_profiles`, `scenarios`.

---

## Corrections to the previous version of this file

The README that shipped with v1 advertised several things that were not true. They are listed here
rather than quietly deleted, because the gap between what a README claims and what a repository
does is itself worth seeing.

| It said | Actually |
|---|---|
| MediaPipe Face Mesh renders a 468-point overlay | `WebcamOverlay.tsx` existed and was imported by nothing. Dead code, advertised as a headline feature (finding `2.3`) |
| `dialogue-queue-api` "returns `request_id` for polling" | There is no `request_id` field and nothing polls. The queue holds an SSE connection open and streams; the frontend never references it |
| Emotion frames POSTed "every 500ms" | 1000ms, in both versions |
| The persona engine classifies into "three types" named Guided Learner / Social Practice Learner / Independent Communicator | Five, named `shy_chick`, `steady_turtle`, `curious_monkey`, `zippy_sotong`, `garang_crab`. The three-name vocabulary belongs to an earlier design that was superseded without the README being updated |
| Kubernetes and Kong are "explicitly deferred" post-MVP | Both are in the repository. `k8s/` is 905 lines |
| Icon categories: Core Words, Social, Emotions, Actions, People, Descriptors | Three: 58 core words, 38 social, 32 emotions, 128 in total, plus a per-scenario set |
| Tables `User`, `LearnerProfile`, `Scenario`, `Session`, `SessionEvent` | `sessions`, `session_events`, `emotion_events`, `learner_profiles`, `scenarios` |

Two more, from the audit and the rebuild:

- **The audit itself said 136 icons.** It is 128. Corrected in the dossier.
- **v2 accumulated its own unmeasured claim.** A comment said the landmarker costs "~8ms per frame,
  under 1% of a core". Measured on the deployed build it is ~29ms, so nearer 3%. Corrected in place.

---

## Layout

```
sabi/
  v2/                  the app that runs. Vercel root directory points here
    src/app/api/       seven route handlers
    src/lib/           pure modules; everything testable lives here
    db/migrations/     NNNN_snake_name.sql, applied in sort order
    evals/             scoring eval set, workflow_dispatch only
    bench/             latency and cost harness, no CI trigger
  frontend/            v1 client            \
  dialogue-engine/                           |
  session-service/                           |  frozen, still runnable,
  dialogue-queue/                            |  gated by CI
  expression-service/                        |
  persona-engine/                            |
  aac-icon-service/                          |
  kong/  k8s/  tests/locust/                 |
  docker-compose.yml  dev.sh                /
  ARCHITECTURE.md      how v2 works
  DECISIONS.md         what changed, why, and what it cost
  MEASUREMENTS.md      real numbers and how they were taken
  BACKLOG.md           what is deferred, and why
```

---

## Credits

AAC pictograms are from [ARASAAC](https://arasaac.org/), used under CC BY-NC-SA. They are fetched
at build time and committed, so the board works offline.
