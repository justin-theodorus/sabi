# Backlog

Anything that is not in the current phase lands here rather than in the branch. Phase numbers
refer to `sabi-rebuild-plan.md`; finding ids (`2.9`, `S5`, `3.1`) refer to `sabi-evidence.md`.

## Deferred out of Phase 1 deliberately

| Item | Phase | Note |
|---|---|---|
| `POST /api/hint` | later | The Learning-mode Sabi hint bar: a second model call 4s after each NPC reply (`SabiHintBar.tsx:25-32`). Not in Phase 1's task list; adds a third route and its own timer to the reducer. |
| TTS | later | ElevenLabs sentence-chunked audio. The design is sound once `2.16` is fixed (v1 gathers every sentence's audio before emitting any, so the listener hears nothing until the slowest call returns). Not load-bearing for either interview angle. |
| Client-side emotion capture | 3 | The whole point of Phase 3. `PromptInput.emotion` and its prompt branch are already ported and tested, so wiring it is a matter of populating one field. |
| Session report at `/report/[sessionId]` | 4 | Transcript, emotion timeline, competence radar. The event log is already the transcript, so the data is there. |
| `/score-session` with tool-use | 2, 4 | Enforced schema replacing v1's markdown-fence stripping and five silent `float(scores.get(k, 50))` defaults. |
| Other three scenarios | — | Needs commissioned art (`2.11`). Single-scenario done properly is the stronger showcase. |
| Video recording to Blob | 5 | Optional. Costs storage and adds a failure mode. |

## Known defects carried forward on purpose

- **`2.9` — `detectNpcEmotion` returns "confused" for almost every reply.** Ported bug-for-bug in
  `v2/src/lib/dialogue/detect-npc-emotion.ts`, with five tests that pin the wrong behaviour so
  Phase 2's fix has something to break. Reproduced live again during Phase 1: every turn of the
  end-to-end run came back `confused` because the NPC is instructed to ask one question per turn
  and `?` short-circuits the branch order. The NPC sprite is therefore effectively frozen. Fix is
  Phase 2: ask the model for the emotion in the dialogue call already being made.

- **`S5` — error taxonomy.** Phase 1 adds a 30s timeout and a 12-row history cap, which were the
  two cheap halves. Distinguishing connection errors, overload, timeout and malformed output,
  each with a defined user-visible behaviour, is Phase 2. Today every model failure surfaces to
  the learner as one generic message, and the AI SDK masks the underlying cause: an invalid API
  key reads as "No output generated. Check the stream for errors."

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
