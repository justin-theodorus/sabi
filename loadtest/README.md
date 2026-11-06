# loadtest

A working load-test path for v1, built entirely outside the frozen tree.

v1 is gated by the `v1-frozen` job in `.github/workflows/v2.yml`, which fails CI if anything under
`dialogue-queue/`, `expression-service/`, `tests/` and nine other paths changes. Two of the three
defects that stop v1's load test from measuring anything live inside that gate. Nothing here edits
them. `patches/` holds copies, and `compose.loadtest.yml` mounts the copies over the originals at
runtime.

The findings, the before/after numbers and the saturation curve are in `MEASUREMENTS.md` §9.

## Why not docker-compose.override.yml

That name is auto-loaded by every bare `docker compose up` and by `dev.sh`. Using it would make v1
look fixed to anyone who runs the repo normally. v1 is a deliberate artifact and its default path
should keep reporting its real behaviour, so the overlay is opt-in via an explicit `-f`.

## What each patch changes

| file | defect | change |
|---|---|---|
| `patches/dialogue-queue-index.js` | SSE relay returned 0 bytes to every client | `res.on('close')` rather than `req.on('close')`, which fired instantly because `express.json()` drains the request body. Headers now flush after a successful enqueue, so a broker failure is a 502 rather than an empty 200 |
| `patches/expression-main.py` | DeepFace never ran; failures returned 200 | Failed warmup marks the service degraded and `/analyze-frame` returns 503. The `neutral: 100.0` fallback that masked every exception is gone |
| `expression.Dockerfile` | opencv 5.0.0.93 ships no haarcascades | Layers `opencv-python-headless==4.10.0.84` onto the built v1 image and bakes the emotion weights, so first-call download is not measured as latency |
| `patches/locustfile.py` | the harness reported broken legs as successes | Asserts all three legs, reads `/translate`'s real `text` key, and fires the SSE drain duration as its own metric because locust stops its timer at headers received |

## Running

Bring up the stack with the overlay. `--no-deps` skips `session-service`, `persona-engine`, `minio`
and `frontend`, none of which any locust class touches.

```sh
cd "$(git rev-parse --show-toplevel)"
docker compose -f docker-compose.yml -f loadtest/compose.loadtest.yml build expression-service
docker compose -f docker-compose.yml -f loadtest/compose.loadtest.yml up -d --no-deps \
  redis dialogue-engine dialogue-queue-api dialogue-queue-worker aac-icon-service expression-service
docker compose -f docker-compose.yml -f loadtest/compose.loadtest.yml up -d --no-deps kong
```

Confirm DeepFace actually loaded before trusting any emotion number. `model_ready` must be `true`:

```sh
curl -s localhost:8003/health
```

Locust must run on the pinned version. `tests/locust/requirements.txt` pins 2.29.1 and the version
on PATH may differ:

```sh
python3.12 -m venv /tmp/locustenv
/tmp/locustenv/bin/pip install -r tests/locust/requirements.txt
```

Use explicit flags, not `--config`. `tests/locust/locust.conf` sets `headless = false`, and its
suggested `--tags expression|dialogue|full-session` commands select nothing because the locustfile
contains no `@tag` decorator.

```sh
# End-to-end session through Kong. Keep to <= 6 users: kong/kong.yml:22-28 and :68-74 apply
# minute: 120, limit_by: ip, and locust runs from one IP, so more users measure the limiter.
/tmp/locustenv/bin/locust -f loadtest/patches/locustfile.py --host http://localhost:8000 \
  FullSessionUser --headless -u 5 -r 1 -t 120s \
  --csv loadtest/results/fullsession --html loadtest/results/fullsession.html

# Saturation. Goes direct to the queue API, so Kong's per-IP limiter does not bind.
/tmp/locustenv/bin/locust -f loadtest/patches/locustfile.py --host http://localhost:8006 \
  DialogueStreamStressUser --headless -u 24 -r 4 -t 60s \
  --csv loadtest/results/saturation-24 --html loadtest/results/saturation-24.html
```

Tear down with `docker compose down`.

## Before you run anything

- **Every enqueued turn is a real Claude call**, including turns whose output no client reads. Keep
  runs short.
- **The worker is the bottleneck, not the engine.** `WORKER_CONCURRENCY=2` on one replica caps
  throughput near 2 requests per second whatever the user count. See §9.5.
- **ElevenLabs is absent.** The key on this account returns 402 and trips `_elevenlabs_disabled` on
  first call, so no figure here includes TTS.
