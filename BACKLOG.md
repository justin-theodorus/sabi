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

- **`is_repair` has no v2 equivalent.** `2.9` fixed the emotion the flag was derived from, but
  nothing writes the flag itself. Phase 4 decides whether the therapist log needs it.

- **Three emotion taxonomies are still live.** Six NPC sprite labels, twelve in v1's
  `/summarize-emotion`, seven from DeepFace. Phase 3 has to reconcile the two learner-side sets.
