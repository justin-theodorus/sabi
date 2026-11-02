# Measurements

Every performance claim in v1 is a prediction written in a comment. There are six of them, none
was ever measured, and `sabi-evidence.md:784-791` marks all six `UNVERIFIABLE`. There is no
committed load-test output anywhere in the repo, no CSV, no screenshot, no logged number.

This file is the correction. Everything below was taken against the deployed app on a stated
commit, with the method and the sample size next to each figure.

v1 is frozen and gated in CI, so its six comments are **superseded here rather than edited**.
See the last section. v2's own unmeasured comments were corrected in place, and one of them turned
out to be wrong by 3.5x.

---

## 1. Environment

Every number in sections 2 to 5 comes from this configuration. Nothing below is comparable to a
figure taken anywhere else, which is the lesson of section 6.

| | |
|---|---|
| Target | `https://sabi-lyart.vercel.app`, the production alias, public, no SSO |
| Commit | `21e09d9` on `v2-rebuild` |
| Date | 2026-09-13 |
| Runtime | Next 16.3.5, React 19.2.8, `ai` 7.0.99, Node 22 |
| Provider | **Vercel AI Gateway**, authenticated by OIDC. Production has no `SABI_MODEL_PROVIDER`, no `ANTHROPIC_API_KEY` and no `AI_GATEWAY_API_KEY`, so `lib/ai/model.ts` takes its default path |
| Model | `anthropic/claude-haiku-4.5`, resolved by the gateway to provider `anthropic` |
| Function region | `iad1` (Washington DC) |
| Edge | `sin1` (Singapore), from `x-vercel-id: sin1::iad1::…` |
| Client | Node 22 on darwin/arm64, residential connection in Singapore |
| Concurrency | 1. Sessions are the unit of concurrency and turns within a session are serial |

**The client is 15,000km from the function.** That is not incidental: roughly 300ms of every
figure in section 2 is the Pacific. Section 2.3 separates it out.

### How to reproduce

```sh
cd v2
npm run bench -- --url=https://sabi-lyart.vercel.app --sessions=6 --turns=6 \
  --from="Singapore (residential, sin1 edge)" --note="..."
npm run bench:cost -- --since=<ISO timestamp>
```

`npm run bench` needs no secret and can be pointed at any deployment. `npm run bench:cost` reads
`model_calls` and needs `DATABASE_URL`. Raw results are committed under `v2/bench/results/`.

---

## 2. Turn latency

### 2.1 As the learner experiences it

36 turns, 6 sessions of 6 turns, measured client-side from request start.

| metric | n | min | p50 | p95 | max |
|---|---|---|---|---|---|
| response headers | 36 | 1092ms | 1311ms | 2255ms | 2877ms |
| **time to first token (visible)** | 36 | 1100ms | **1317ms** | **2263ms** | 2893ms |
| time to complete turn | 36 | 1139ms | 1454ms | 2343ms | 3141ms |
| stream close | 36 | 1140ms | 1454ms | 2344ms | 3148ms |

Excluding the first call of the run, which was the only plausibly cold invocation:

| metric | n | min | p50 | p95 | max |
|---|---|---|---|---|---|
| time to first token (visible) | 35 | 1100ms | 1317ms | 1649ms | 2263ms |
| time to complete turn | 35 | 1139ms | 1454ms | 1803ms | 2343ms |

Cold start is **not inferred** from a header, because it cannot be. The first invocation is simply
excluded and reported both ways; the deployment had been idle for over five minutes beforehand.
The p95 difference between the two tables, 2263ms against 1649ms, is that single call.

Note that response headers arrive at 1311ms and the first token at 1317ms. **The platform does not
flush headers early on a streamed response**, so there is no "the page is responding" signal ahead
of the first token; the six milliseconds between them is the entire head start the client gets.

### 2.2 As the server sees it

The same 36 calls, recorded server-side into `model_calls` by the instrumentation this phase added.

| | p50 | p95 |
|---|---|---|
| time to first token, **model** (`performance.timeToFirstOutputMs`) | 696ms | n/a |
| time to first token, **visible** (our first `text-delta`) | 1002ms | n/a |
| total call | 1171ms | 1504ms |

Tokens: mean 1152 in, 43 out.

### 2.3 Where the 1317ms actually goes

This is the decomposition the phase exists to produce.

| segment | p50 | how it was measured |
|---|---|---|
| model produces its first token | 696ms | SDK `timeToFirstOutputMs` |
| → first token the **learner** can see | +306ms | visible TTFT minus model TTFT, per call |
| → arrives at a client in Singapore | +315ms | client TTFT minus server visible TTFT |
| **total** | **1317ms** | client-side, section 2.1 |

The transport figure is corroborated independently. `POST /api/translate` is a pure function with
no I/O and no model call, so it measures transport plus function overhead and nothing else:

```sh
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{time_total}\n" \
  -X POST https://sabi-lyart.vercel.app/api/translate \
  -H 'Content-Type: application/json' -d '{"icons":["I","want","chicken rice"]}'; done
```

n=25: min 272ms, **p50 293ms**, p95 328ms, max 360ms. That agrees with the 315ms derived above.

**So: a learner sitting next to the function would see roughly 1000ms, not 1317ms.** Both numbers
are real; they answer different questions, and neither is quotable without saying where the client
was. Nobody has yet measured this from a client near `iad1`.

### 2.4 The 306ms is the structured-output cost, finally isolated

The gap between model TTFT and visible TTFT is the model emitting `{"emotion":"…","farewell":…`
before it reaches `"reply"`. None of that is visible to a learner, and it is the price of the
schema that Phase 2 introduced and Phase 4 extended.

Phase 2 estimated it at "roughly 200-500ms" by comparing two runs on different days, and tried
reversing the field order to recover it, which did not work. It is now **306ms at p50, measured
per call on the same call**, with no A/B and no cross-run comparison. It is a real cost and it
falls squarely inside Phase 2's estimated range.

---

## 3. Tokens and cost

Same run: 36 dialogue calls plus 6 scoring calls, one per session, fired from the end route's
`after()`.

| route | calls | p50 total | p95 total | mean in | mean out | cost |
|---|---|---|---|---|---|---|
| dialogue | 36 | 1171ms | 1504ms | 1152 | 43 | $0.049125 |
| scoring | 6 | 2040ms | 5480ms | 1310 | 99 | $0.010817 |

| | |
|---|---|
| **per turn** (dialogue only) | **$0.001365** |
| **per scored session** (6 turns + 1 scoring call) | **$0.009990** |
| worst session observed | $0.010188 |

So roughly **a tenth of a cent per turn and one cent per session**, at Haiku 4.5 prices, for a
six-turn session. A survival session costs more: it adds a `/judge` call per turn, which is why
that call site is instrumented too even though no survival session appears in this run.

`unreadable: 0` across all 42 calls: the gateway's cost report parsed cleanly every time. Costs
are stored as `numeric(12,8)` and summed in Postgres, never as floats in JavaScript.

**Input dominates output roughly 27 to 1.** The system prompt, the scenario, and up to twelve
turns of history are re-sent on every turn; the reply is capped at 256 tokens and averages 43.
Nothing here is cached, and on this model nothing can be. `cache_read_tokens` and
`cache_write_tokens` were zero on every call because Haiku 4.5 will not cache a prefix shorter than
4,096 tokens, and the whole prompt averages 1152. Even a 12-turn session, the cap, stays well under
it. Below the minimum a `cache_control` marker is accepted and silently ignored, so adding one would
have changed no number in this file. An earlier draft called caching "the obvious lever"; it is not
a lever at all at this prompt size on this model.

---

## 4. Client-side emotion inference

Measured by the app on itself. `sampleFrame` times the `detectForVideo` call, the reducer collects
the durations regardless of phase or whether a face was found, and each turn's window is
summarised into the `npc_response` payload. Every real session on every real device therefore
self-reports, with no benchmark page and no device lab.

6 turns across 2 sessions, 81 frames.

| | |
|---|---|
| per-turn p50, range across turns | 27.6ms – 31.4ms |
| mean of per-turn p50 | **29.1ms** |
| worst single frame | 100.7ms |
| device | Chromium 151 on an M-series Mac |
| video source | 640x480 canvas stream at 10fps, sampled at 1Hz |
| faces found | 73 of 81 frames, so the blendshape path is included |

Headless and headed runs agree to within 2ms, so the headless software rendering path is not the
variable.

**This contradicts the number in the code.** `lib/turn/constants.ts` said "at ~8ms of inference per
frame this is under 1% of a core", inherited from the Phase 3 spike. Measured here it is ~29ms, so
at 1 Hz it is closer to **2.9% of a core** than to 1%. Both conclusions survive: that the sample
rate is affordable, and that the emotion loop costs no measurable TTFT. The stated figure does
not, and the comment has been corrected.

Two honest caveats. The video source is a canvas stream rather than a hardware webcam, and a real
camera frame may cost differently. And the Phase 3 spike's 8.4ms was taken by a method that was
never written down, so this does not refute it so much as replace it with something checkable.

---

## 5. Assets and payload

The NPC sprites are 2.40–2.57MB each, 14.0MiB for six, and `BACKLOG.md` flagged them as worth
compressing before this phase measured anything. Measured:

| | bytes |
|---|---|
| `npc/uncle/happy.png`, raw | 2,574,362 |
| the same sprite through `next/image` at `w=640&q=75` | 103,196 (webp) |

**A 96% reduction, already happening.** They render through `next/image`, so compressing the source
assets would not save a learner a single byte. It would only shrink the deploy upload and the
build. v1's copies are byte-identical and frozen, so the repository does not shrink either way.

**Decision: not compressed.** The note in `BACKLOG.md` assumed a cost that delivery optimisation
had already removed, which is precisely the kind of assumption this phase exists to test rather
than act on.

`v2/public` is 48MB, of which 26MB is the MediaPipe wasm copied in at build time and gitignored,
14MB is sprites, 8.5MB is 318 icons, and 3.76MB is the committed `face_landmarker.task`.

---

## 6. Nothing before this file is comparable to anything

Phases 1 to 4 each recorded a TTFT median. They are not comparable to each other, and none is
comparable to section 2. Stated plainly because every one of them is quoted in a comment or in
`BACKLOG.md` and could easily be read as a series:

| phase | figure | host | provider |
|---|---|---|---|
| 1 | 1449ms median | deployed | gateway |
| 2 | 1650–1949ms median over four passes | deployed, structured output added | gateway |
| 3 | 2115–2191ms | **local `next start`** | **direct Anthropic key** |
| 4 | 1319ms vs 1591ms | **local `next start`** | **direct Anthropic key** |

Different builds, different hosts, different providers, and in no case was the sample size, the
client location or the model id recorded. **Only the within-run comparisons in phases 3 and 4 ever
meant anything**, and both were explicitly framed that way at the time.

This is why `v2/bench/results/*.json` stamps the target, the commit, the branch, the client, the
client's stated location, the concurrency and the sample count into every run, and why the bench
refuses to print a p95 below 20 samples.

---

## 7. v1's six claims, superseded

v1 is frozen. `k8s/`, `dialogue-queue/`, `session-service/`, `dev.sh` and `kong/` are all gated by
the `v1-frozen` job in `.github/workflows/v2.yml`, which fails if any of them changes. The rebuild
plan's instruction to "delete or correct any surviving comment that asserts a number nobody
measured" therefore cannot mean editing them. They are corrected here instead, which is also the
more useful artifact: the claim, and what the equivalent path actually does in v2.

| v1 claim | where | status | what v2 measured |
|---|---|---|---|
| "Stress test shows: 1 pod saturates at ~15 concurrent sessions" | `k8s/expression-service.yaml:57` | **Never measured.** The number originates in the load test's own stated *goal* (`locustfile.py:19-20`) and was restated in a k8s comment as a finding. No cluster was ever stood up | Not applicable: expression inference runs in the browser in v2, so there is no pod to saturate. Per-frame cost is §4 |
| "With HPA: 3 pods handle ~45 sessions at the same latency" | `k8s/expression-service.yaml:58` | **Never measured**, and doubly so: it is linear extrapolation from the line above, and nothing measured latency at all | As above |
| "at 10s min/call → 36 req/min max" | `dialogue-queue/worker.js:12` | **Never measured**, and load-bearing: the 10s floor is the input to an argument for *deleting* a rate limiter (`:13`). Nothing establishes it | Measured: a dialogue call totals **1171ms at p50**, 1504ms at p95, roughly an order of magnitude below the assumed floor. Had the queue shipped, its concurrency arithmetic would have been wrong in the unsafe direction |
| "DeepFace model warmup takes ~15s" | `k8s/expression-service.yaml:33` | **Never measured**, and contradicted three files away: `dev.sh:37` says ~30s for the same warmup | Not applicable. No model is downloaded server-side; the 3.76MB landmarker is committed and served same-origin |
| "Buffer in Redis for sub-10ms writes" | `session-service/index.js:653` | **Never measured**, and structurally unfalsifiable as written: the path is two round trips and falls back to Supabase when Redis is down | Not applicable. v2 has no Redis and no per-frame write: the per-turn aggregate goes into the `npc_response` payload in the same transaction as the turn |
| "Rate limit: 45 req/min (Redis sliding window across all worker pods)" | `locustfile.py:143,327` | **Describes a limiter that does not exist** anywhere in the codebase, so the test's own success criterion could never be evaluated | v2 has one limiter, not four disagreeing ones |

### And one defect carried forward rather than fixed

`tests/locust/locustfile.py:276` reads a `translation` key from `/translate`. Neither
`aac-icon-service` nor v2's `/api/translate` has ever returned that key; both return `{ text }`,
so the expression silently fell back to `" ".join(icons)` on every run ever made. The translate leg
was timed and its output discarded, and nothing said so.

It is **not fixed in place**, because `tests/` is frozen. The v2 harness at `v2/bench/` inherits the
lesson as a design rule instead: `bench/assert.ts` has no defaults and no optional-chained
fallbacks, every field it reads is asserted, and every failure names what it found instead. A shape
it does not recognise stops the run rather than quietly becoming a fiction.

The patched copy under `loadtest/` reads `text` and fails the request when it is missing, which is
how §9.4's translate leg came to measure the string it actually sends.

---

## 8. What is still not measured

Listed because an unmeasured thing named is worth more than an unmeasured thing implied.

- **Tablets.** Per-frame inference has never run on an iPad or any tablet. The mechanism in §4 is
  device-agnostic, so opening the production alias on one and playing a session is now sufficient
  to close this: the numbers land in the database by themselves.
- **A client near the function.** Every figure in §2 carries ~300ms of Pacific. A run from a
  US-East host would separate the product's latency from this laptop's geography.
- **Load.** Everything here is `--concurrency=1`. The harness supports higher concurrency and a
  separate result file, but no contended run has been taken, so nothing is known about behaviour
  under simultaneous sessions.
- **Cold start, isolated.** The first call of a run is excluded and reported, which brackets it but
  does not measure it.
- **A real webcam.** §4's video source is a canvas stream.
- **Survival mode cost.** The `/judge` call is instrumented but no survival session is in this run,
  so per-session cost for survival is inferred from the per-call numbers rather than observed.
- **Prompt caching does not apply.** Not unmeasured but inapplicable: Haiku 4.5's minimum
  cacheable prefix is 4,096 tokens and the prompt is ~1,150 (§3). It only becomes available with a
  model whose minimum is lower, which is a model change and needs the eval suite rerun first.

---

## 9. v1's load test, made to measure something

§7 established that the "1 pod saturates at ~15 concurrent sessions" claim was never measured. This
section is what happened when the load test was made capable of measuring anything at all.

Running `FullSessionUser` as shipped produces a clean report: 102 requests, **0 failures, 5ms
median**. Every number in it is false. All three legs of the session turn fail silently as HTTP 200,
and the report cannot distinguish a working service from a dead one. Three separate defects
combine to produce that result.

### 9.1 The relay never returned anything to the client

`dialogue-queue/index.js:56` registers `req.on('close', cleanup)`. On Node 16+ (the container runs
v18.20.8) `IncomingMessage` emits `close` as soon as its body stream is consumed, and
`express.json()` consumes it before the handler body runs. `cleanup()` therefore unsubscribed from
the Redis channel and called `res.end()` before the job was even enqueued.

An in-container probe, rather than inference from the source:

```
REQ close fired at +3ms  writableEnded=false
event: late                      <- a write 300ms later still arrived, so the client had NOT gone
RES close fired at +309ms
```

The client had not disconnected. The handler only believed it had. The worker then performed the
full Claude call and published to a channel with no subscriber: **36 real Claude calls were made
and paid for during that run, and no client received one of them.** The load test reported the leg
as a 3ms success with an average content length of 0 bytes, and 0 bytes was never treated as
failure.

`dialogue-engine` itself was never at fault. Called directly it streams correctly.

### 9.2 DeepFace had never run, in any session, ever

`expression-service` logged this at every startup and continued:

```
Warmup error (non-fatal): ('Confirm that opencv is installed on your environment!
Expected path ', '.../cv2/data/haarcascade_frontalface_default.xml', ' violated.')
```

`expression-service/requirements.txt` pins nothing, and the Dockerfile ends with an unpinned
`--force-reinstall opencv-python-headless`, so the build resolved to **opencv 5.0.0.93**, whose
`cv2/data/` contains only `__init__.py`. The haarcascade the `opencv` detector backend looks for
does not exist in that release. `/root/.deepface/weights/` was empty: the emotion model was never
downloaded, because warmup raised before it got that far.

Every `/analyze-frame` call therefore threw, and `main.py:88-93` caught it and returned
`neutral: 100.0` with every other label at `0.0`, over HTTP 200, in ~95ms. That response was the
exception path. **The ~95ms figure is the cost of constructing a fallback, not of inference**, and
no emotion was ever inferred by the server in v1's life.

This also retires the `k8s/expression-service.yaml:57` claim by a shorter route than §7 took. A pod
cannot saturate on inference it is not performing.

### 9.3 Both handlers returned HTTP 200 on total failure

The property that makes the other two unfalsifiable. A harness that cannot separate working from
broken measures neither, and under load this is the worst available behaviour: the report gets
greener as the system gets deader, because failing fast is cheaper than succeeding.

The locustfile has the same defect on the client side. `FullSessionTasks` called `resp.success()`
whenever `resp.ok`, without ever checking that `full_text` was non-empty.

### 9.4 What it measures once the three are fixed

v1 is frozen, so none of this is fixed in place. `loadtest/` holds patched copies outside the gated
tree and a compose overlay that mounts them, deliberately not named `docker-compose.override.yml`
so that the default path keeps reporting v1's real behaviour. See `loadtest/README.md`.

With the relay fixed, opencv pinned to 4.10.0.84, the weights baked in, failures returning 5xx, and
the locustfile asserting all three legs, the same `FullSessionUser` scenario at 5 users for 120s
through Kong:

| leg | p50 | p95 | n | fails |
|---|---|---|---|---|
| `/analyze-frame` (real DeepFace inference) | **19ms** | 110ms | 122 | 0 |
| `/translate` | **2ms** | 18ms | 122 | 0 |
| `/dialogue/stream` full drain to `full_text` | **870ms** | 1300ms | 121 | 0 |

0 failures here means the streams arrived, the emotion scores were real distributions rather than
the neutral fallback, and `full_text` was non-empty on all 121 turns. The previous 0 meant nothing.

Two notes on the numbers. Real inference at 19ms p50 is **five times faster than the 95ms fallback**
it replaced, so the one performance figure v1 could produce was also its slowest path. And locust
records a `stream=True` response time at headers received, which for this leg is the enqueue cost
(4ms), not the turn: the 870ms above is a separately fired drain metric, because the shipped harness
would have reported this leg as 4ms even after the relay was fixed.

### 9.5 The actual saturation ceiling

Kong applies `minute: 120, limit_by: ip` to `/dialogue` and `/analyze-frame`
(`kong/kong.yml:22-28`, `:68-74`). Locust runs from one IP, so the docstring's 20 users measures
Kong's limiter rather than SABI. These runs go directly to the queue API to avoid that.

| users | dialogue p50 | p95 | throughput |
|---|---|---|---|
| 5 (via Kong) | 870ms | 1300ms | 1.01 req/s |
| 12 | 2300ms | 3300ms | **1.98 req/s** |
| 24 | 7600ms | 8500ms | **2.15 req/s** |

Throughput pins at roughly **2 requests per second** and stays there while latency inflates 8.7x.
That ceiling is `WORKER_CONCURRENCY=2` on a single worker replica, and it is not a coincidence of
this hardware: it is two concurrent Claude calls at a service time near 1s. Users beyond that buy
queue depth, not throughput.

So the real answer to the frozen "~15 concurrent sessions" claim is that **the binding constraint
was never the expression pod at all.** It is a two-slot worker in front of an upstream API, and it
binds at a concurrency the original claim never considered.

### 9.6 What this section does not measure

- **Real faces.** The locust frame is synthetic noise, so the classifier runs and returns a genuine
  distribution over a meaningless input. Detection was verified separately: the cascade loads
  (`empty: False`) and `detectMultiScale` executes. Accuracy on real webcam input is untested.
- **ElevenLabs.** The key on this account is a free-plan key returning 402, which trips
  `_elevenlabs_disabled` on first call. TTS is absent from every figure above, so the "full
  production path" the test's docstring claims to exercise has never included it.
- **`session-service` and `persona-engine`.** No locust class touches either, so both are excluded
  from the stack these runs used. Supabase is therefore irrelevant to this entire section.
- **Sustained load.** The longest run here is 120s.
