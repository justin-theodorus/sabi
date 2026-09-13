# Backlog

Anything that is not in the current phase lands here rather than in the branch. Phase numbers
refer to `sabi-rebuild-plan.md`; finding ids (`2.9`, `S5`, `3.1`) refer to `sabi-evidence.md`.

## Deferred out of Phase 1 deliberately

| Item | Phase | Note |
|---|---|---|
| `POST /api/hint` | later | The Learning-mode Sabi hint bar: a second model call 4s after each NPC reply (`SabiHintBar.tsx:25-32`). Not in Phase 1's task list; adds a third route and its own timer to the reducer. |
| TTS | later | ElevenLabs sentence-chunked audio. The design is sound once `2.16` is fixed (v1 gathers every sentence's audio before emitting any, so the listener hears nothing until the slowest call returns). Not load-bearing for either interview angle. |
| Client-side emotion capture | DONE (3) | MediaPipe Face Landmarker blendshapes, in the browser. `PromptInput.emotion` is populated by `/api/dialogue`. |
| Session report at `/report/[sessionId]` | 4 | Transcript, emotion timeline, competence radar. The event log is already the transcript, so the data is there. |
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

- **AI Gateway needs a card on the Vercel team before it will serve requests.** OIDC auth already
  works; the gateway returns 403 `customer_verification_required` until then. v2 runs on the
  direct Anthropic key meanwhile via `SABI_MODEL_PROVIDER=anthropic`
  (`v2/src/lib/ai/model.ts`). Switching back is deleting that one env var — worth doing before
  Phase 5, which wants the gateway's per-request token and cost numbers.
- **Vercel preview URLs sit behind SSO.** The production alias is public, but branch and PR
  previews hit a Vercel login wall, which cuts against the plan's "no auth wall" goal. Untouched
  so far because it is a project security setting.
- **NPC sprites are ~2.4MB each, 14MB total.** Served through `next/image`, so they are optimised
  on delivery, but the source assets are worth compressing before Phase 5 measures anything.

## Surfaced by Phase 2, deferred on purpose

- **Structured output costs roughly 200-500ms of TTFT.** Median TTFT over four passes of ten real
  turns ranged 1650-1949ms against Phase 1's 1449ms baseline, and the spread is dominated by
  run-to-run variance rather than by the change. Reversing the schema field order to put `reply`
  first was measured and did NOT recover it (1925ms median, plus a marker miss), so the ordering
  stays as it is. Phase 5 measures this properly; treat the numbers here as indicative.

- **The scoring rubric penalises absence of opportunity.** `strong-03` scores 7/100 on strategic
  because nothing ever goes wrong in that transcript, so the learner never has to repair anything.
  That is not the same as lacking the skill. Either the rubric needs an explicit "not observed"
  band or the dimension needs to be nullable. Decide at Phase 4, with the report design in hand.

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

- **`is_repair` has no v2 equivalent.** `2.9` fixed the emotion the flag was derived from, but
  nothing writes the flag itself. Phase 4 decides whether the therapist log needs it.

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

## Surfaced by Phase 3, deferred on purpose

- **A failed session start cannot be retried. Phase 1 defect, found by review in Phase 3, NOT
  fixed — it is outside this phase.** `startedEffects` in `use-turn.ts:25` is a `Set` that is
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
