"""
SABI Stress Test Suite
======================
Run via Kong (full stack):
    locust -f tests/locust/locustfile.py --host http://localhost:8000

Run dialogue engine independently (bypasses Kong + queue):
    locust -f tests/locust/locustfile.py --host http://localhost:8001

Run a single user class (headless):
    locust -f tests/locust/locustfile.py --host http://localhost:8000 \\
           --headless -u 20 -r 2 --run-time 3m --class-picker
    # or pass the class name as positional arg:
    locust -f tests/locust/locustfile.py --host http://localhost:8000 \\
           --headless -u 20 -r 2 --run-time 3m DialogueStreamStressUser

Scenarios
---------
ExpressionStressUser        — floods /analyze-frame to trigger HPA on expression-service
                              Goal: show 1 pod saturates at ~15 concurrent users

DialogueStreamStressUser    — hits /dialogue/stream (SSE) through BullMQ queue
                              Goal: validate queue backpressure + rate limiting (45 req/min)
                              Use --host http://localhost:8000 (Kong → queue-api → engine)

DialogueDirectStressUser    — hits /dialogue/stream directly on dialogue-engine (no queue)
                              Goal: isolate dialogue-engine performance without queue overhead
                              Use --host http://localhost:8001 (requires port exposed in docker-compose)

FullSessionUser             — realistic end-to-end session flow (start → 10 turns → end)
                              Goal: measure p50/p95 latency under combined load
"""

import io
import json
import random
import struct
import time
import zlib

from locust import HttpUser, TaskSet, between, events, task

# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_jpeg(width: int = 48, height: int = 48) -> bytes:
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        length = struct.pack('>I', len(data))
        crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw_rows = b''
    for _ in range(height):
        r, g, b = random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)
        row = bytes([0]) + bytes([r, g, b] * width)
        raw_rows += row
    compressed = zlib.compress(raw_rows)
    return (
        b'\x89PNG\r\n\x1a\n'
        + png_chunk(b'IHDR', ihdr)
        + png_chunk(b'IDAT', compressed)
        + png_chunk(b'IEND', b'')
    )


_DUMMY_FRAME = _make_jpeg()

_DIALOGUE_MESSAGES = [
    "want food please",
    "chicken rice one",
    "how much",
    "thank you",
    "want drink water",
    "spicy no please",
    "takeaway yes",
    "wrong order sorry",
    "more rice please",
    "finished thank you",
]

_SCENARIO_IDS = ["hawker_centre", "queue_shop", "group_project", "home_family"]


def _consume_sse(resp) -> dict:
    """
    Drain an SSE stream and return the payload from the final 'done' event.
    Returns {} if the stream ends without a done event or on error.
    """
    result = {}
    buffer = ''
    event_type = ''
    for chunk in resp.iter_content(chunk_size=None):
        buffer += chunk.decode('utf-8', errors='replace')
        lines = buffer.split('\n')
        buffer = lines.pop()
        for line in lines:
            if line.startswith('event: '):
                event_type = line[7:].strip()
            elif line.startswith('data: '):
                if event_type == 'done':
                    try:
                        result = json.loads(line[6:])
                    except json.JSONDecodeError:
                        pass
                elif event_type == 'error':
                    result = {'error': line[6:]}
                event_type = ''
    return result


def _drain_timed(user, resp) -> dict:
    """Drain an SSE stream and report how long it actually took.

    With stream=True, locust stops its own timer when response headers arrive. For this
    leg that is only the enqueue cost, so the reported 4ms says nothing about the turn
    the learner sits through. Fire the drain duration as its own metric instead.
    """
    start = time.perf_counter()
    exc = None
    done = {}
    try:
        done = _consume_sse(resp)
    except Exception as e:  # noqa: BLE001 - reported to locust, then re-raised
        exc = e
    elapsed_ms = (time.perf_counter() - start) * 1000

    user.environment.events.request.fire(
        request_type="SSE",
        name="/dialogue/stream [full drain]",
        response_time=elapsed_ms,
        response_length=len(done.get("full_text", "")),
        exception=exc,
        context={},
    )
    if exc is not None:
        raise exc
    return done


def _check_emotion(resp) -> None:
    """Mark an /analyze-frame response failed unless it carries real inference.

    v1 caught every DeepFace exception and returned neutral/100.0 over HTTP 200, so a
    service whose model had never loaded reported 0% failures. A scores dict that is
    100.0 neutral and 0.0 everywhere else is that fallback, not a prediction.
    """
    try:
        body = resp.json()
    except Exception:
        resp.failure(f"Non-JSON body: {resp.text[:80]}")
        return

    scores = body.get("scores")
    if not isinstance(scores, dict) or not scores:
        resp.failure(f"No scores in response: {resp.text[:80]}")
        return

    non_neutral = sum(v for k, v in scores.items() if k != "neutral")
    if scores.get("neutral") == 100.0 and non_neutral == 0.0:
        resp.failure("Neutral fallback: DeepFace did not run")
        return

    resp.success()


def _check_reply(resp, done: dict) -> None:
    """Mark a /dialogue/stream response failed unless the NPC text actually arrived."""
    if 'error' in done:
        resp.failure(f"SSE error: {str(done['error'])[:80]}")
        return
    if not done.get('full_text', '').strip():
        resp.failure("Empty stream: no full_text relayed to client")
        return
    resp.success()


# ── Task Sets ─────────────────────────────────────────────────────────────────

class ExpressionTasks(TaskSet):
    """
    Hammers /analyze-frame with synthetic webcam frames.
    One request per second per user mimics real usage (emotion capture interval).
    At 15 concurrent users → 1 pod hits ~70% CPU → HPA fires.
    """
    wait_time = between(0.8, 1.2)

    @task
    def analyze_frame(self):
        with self.client.post(
            "/analyze-frame",
            files={"file": ("frame.png", io.BytesIO(_DUMMY_FRAME), "image/png")},
            name="/analyze-frame",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                _check_emotion(resp)
            elif resp.status_code == 429:
                resp.failure(f"Rate limited: {resp.text[:80]}")
            else:
                resp.failure(f"Unexpected {resp.status_code}: {resp.text[:80]}")


class DialogueStreamTasks(TaskSet):
    """
    Hits /dialogue/stream (SSE) — the real production path through BullMQ queue.
    Drains the full SSE stream so Locust measures total time including TTS.

    With queue: Kong → dialogue-queue-api → BullMQ → dialogue-queue-worker → dialogue-engine
    Rate limit: 45 req/min (Redis sliding window across all worker pods)
    Expected: requests queue cleanly under load; 429s only if Redis limit exceeded
    """
    wait_time = between(2, 5)

    def on_start(self):
        self.history = []
        self.scenario_id = random.choice(_SCENARIO_IDS)

    @task
    def stream_dialogue(self):
        message = random.choice(_DIALOGUE_MESSAGES)
        payload = {
            "message": message,
            "history": self.history[-6:],
            "scenario_id": self.scenario_id,
            "mode": "learning",
            "persona": "zippy_sotong",
        }
        with self.client.post(
            "/dialogue/stream",
            json=payload,
            name="/dialogue/stream",
            stream=True,
            timeout=180,
            catch_response=True,
        ) as resp:
            if resp.status_code == 429:
                resp.failure("Rate limit (429)")
                return
            if not resp.ok:
                resp.failure(f"Unexpected {resp.status_code}: {resp.text[:80]}")
                return

            done = _drain_timed(self.user, resp)
            npc_reply = done.get('full_text', '')
            if npc_reply:
                self.history.append({"role": "user", "content": message})
                self.history.append({"role": "assistant", "content": npc_reply})
            _check_reply(resp, done)


class DialogueDirectTasks(TaskSet):
    """
    Hits /dialogue/stream directly on dialogue-engine (port 8001), bypassing
    Kong and the BullMQ queue entirely. Use to isolate dialogue-engine performance.

    Requires dialogue-engine port to be exposed in docker-compose:
      ports:
        - "8001:8001"
    Run with: --host http://localhost:8001
    """
    wait_time = between(2, 5)

    def on_start(self):
        self.history = []
        self.scenario_id = random.choice(_SCENARIO_IDS)

    @task
    def stream_dialogue_direct(self):
        message = random.choice(_DIALOGUE_MESSAGES)
        payload = {
            "message": message,
            "history": self.history[-6:],
            "scenario_id": self.scenario_id,
            "mode": "learning",
            "persona": "zippy_sotong",
        }
        with self.client.post(
            "/dialogue/stream",
            json=payload,
            name="/dialogue/stream [direct]",
            stream=True,
            timeout=180,
            catch_response=True,
        ) as resp:
            if resp.status_code == 429:
                resp.failure("Rate limit (429) — asyncio semaphore full")
                return
            if not resp.ok:
                resp.failure(f"Unexpected {resp.status_code}: {resp.text[:80]}")
                return

            done = _drain_timed(self.user, resp)
            npc_reply = done.get('full_text', '')
            if npc_reply:
                self.history.append({"role": "user", "content": message})
                self.history.append({"role": "assistant", "content": npc_reply})
            _check_reply(resp, done)


class FullSessionTasks(TaskSet):
    """
    Realistic end-to-end scenario:
      1. × 10 turns:
         a. POST /analyze-frame  — emotion capture
         b. POST /translate      — icon translation
         c. POST /dialogue/stream — NPC response (full SSE)
      Measures realistic p50/p95 latency under combined load.
    """
    wait_time = between(2, 5)

    def on_start(self):
        self.history = []
        self.scenario_id = random.choice(_SCENARIO_IDS)
        self.turn = 0

    @task
    def run_session_turn(self):
        if self.turn >= 10:
            self.turn = 0
            self.history = []
            return

        # 1. Emotion frame
        with self.client.post(
            "/analyze-frame",
            files={"file": ("frame.png", io.BytesIO(_make_jpeg()), "image/png")},
            name="/analyze-frame [in-turn]",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                _check_emotion(resp)
            else:
                resp.failure(f"Unexpected {resp.status_code}: {resp.text[:80]}")

        # 2. Translate icons
        icons = random.choice(_DIALOGUE_MESSAGES).split()[:3]
        with self.client.post(
            "/translate",
            json={"icons": icons},
            name="/translate",
            catch_response=True,
        ) as translate_resp:
            message = " ".join(icons)
            if translate_resp.status_code != 200:
                translate_resp.failure(f"Unexpected {translate_resp.status_code}")
            else:
                # The service returns {"text": ...}. v1 read "translation", which is
                # absent, so every turn silently fell back to the bare icon join and
                # sent "want food please" instead of "I want food please".
                translated = translate_resp.json().get("text", "")
                if translated.strip():
                    message = translated
                    translate_resp.success()
                else:
                    translate_resp.failure(f"No text key in response: {translate_resp.text[:80]}")

        # 3. Dialogue turn (SSE)
        with self.client.post(
            "/dialogue/stream",
            json={
                "message": message,
                "history": self.history[-6:],
                "scenario_id": self.scenario_id,
                "mode": "learning",
                "persona": "steady_turtle",
            },
            name="/dialogue/stream [in-turn]",
            stream=True,
            timeout=180,
            catch_response=True,
        ) as resp:
            if resp.status_code == 429:
                resp.failure("Rate limited")
            elif resp.ok:
                done = _drain_timed(self.user, resp)
                npc_reply = done.get('full_text', '')
                if npc_reply:
                    self.history.append({"role": "user", "content": message})
                    self.history.append({"role": "assistant", "content": npc_reply})
                _check_reply(resp, done)
            else:
                resp.failure(f"{resp.status_code}")

        self.turn += 1


# ── User Classes ──────────────────────────────────────────────────────────────

class ExpressionStressUser(HttpUser):
    """
    Stress expression-service to trigger HPA.
    Ramp: 1 → 80 users over 2 minutes.
    Watch: kubectl top pods -n sabi -l app=expression-service
    Expected: HPA fires at ~15 users (1→2 pods), again at ~30 (2→3 pods).
    """
    tasks = [ExpressionTasks]
    wait_time = between(0.8, 1.2)


class DialogueStreamStressUser(HttpUser):
    """
    Stress /dialogue/stream through the BullMQ queue (full production path).
    Ramp: 1 → 30 users over 2 minutes. --host http://localhost:8000
    Expected: requests queue cleanly; 429s only above 45 req/min (Redis rate limit).
    Watch: docker-compose logs dialogue-queue-worker | grep Completed
    """
    tasks = [DialogueStreamTasks]
    wait_time = between(2, 5)


class DialogueDirectStressUser(HttpUser):
    """
    Stress dialogue-engine directly, bypassing Kong and BullMQ queue.
    Use to isolate engine performance from queue overhead.
    --host http://localhost:8001  (requires port 8001 exposed in docker-compose)
    Ramp: 1 → 10 users. Semaphore limits to CLAUDE_CONCURRENCY=3 concurrent calls.
    Expected: latency climbs as semaphore queues excess requests; 429s on rate limit.
    """
    tasks = [DialogueDirectTasks]
    wait_time = between(2, 5)


class FullSessionUser(HttpUser):
    """
    Realistic mixed load. Use with 10–20 concurrent users.
    Measures end-to-end p50/p95 for a complete SABI session turn.
    --host http://localhost:8000
    """
    tasks = [FullSessionTasks]
    wait_time = between(2, 5)
