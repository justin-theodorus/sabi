# SABI v2

The single-app rebuild of SABI. One Next.js app, no gateway, no queue, no containers. The v1
microservice stack it replaces is still in this repository, one level up, and still runs via
`docker compose up`.

Live at <https://sabi-lyart.vercel.app>. Vercel deploys this directory: the project's Root
Directory is set to `v2`.

The reasoning lives at the repository root: [ARCHITECTURE.md](../ARCHITECTURE.md) for how this
works, [DECISIONS.md](../DECISIONS.md) for what changed from v1 and what it cost,
[MEASUREMENTS.md](../MEASUREMENTS.md) for the numbers.

```bash
npm install
cp .env.local.example .env.local    # or: vercel env pull v2/.env.local --yes, from the repo root
npm run db:migrate
npm run dev                          # http://localhost:3000
```

| command | | costs money |
|---|---|---|
| `npm test` | 323 unit tests, offline against mock providers | no |
| `npm run typecheck` | `next typegen`, then `tsc --noEmit` | no |
| `npm run lint` | eslint | no |
| `npm run build` | next build | no |
| `npm run db:migrate` | applies `db/migrations/*.sql` in sort order | no |
| `npm run eval` | scoring evals, 10 fixtures x 3 real model calls | **yes** |
| `npm run bench -- --url=<url>` | latency bench against a deployed app | **yes** |
| `npm run bench:cost` | reads tokens and cost back out of `model_calls` | no |

`evals/` and `bench/` sit outside `src/` deliberately, so `npm test`'s `src/**/*.test.ts` glob
cannot reach them and an ordinary push can never spend money. `evals` runs in CI on
`workflow_dispatch` only; `bench` has no CI trigger at all, because it drives a live deployment.

## Layout

| | |
|---|---|
| `src/app/api/` | seven route handlers |
| `src/lib/` | pure modules. Anything that needs asserting lives here, because the test runner matches `.ts` only and there is no React test renderer, so a `.tsx` file's logic is logic nobody can test |
| `db/migrations/` | `NNNN_snake_name.sql`, applied in sort order, each in its own transaction |
| `evals/` | the scoring eval set and its committed results |
| `bench/` | the latency and cost harness and its committed results |

## Copied from v1, unchanged

| Path | From | Note |
|---|---|---|
| `src/app/globals.css` | `frontend/src/app/globals.css` | Design tokens and the SF Rounded stack. The three `@tailwind` directives and the one `@apply` rule were expanded to plain CSS; v2 has no Tailwind, and nothing copied used a utility class. |
| `src/components/AACBoard.tsx` | `frontend/src/components/AACBoard.tsx` | The `ICONS` table holds 128 entries across three categories. |
| `public/icons/` | `frontend/public/icons/` | 318 ARASAAC pictograms, byte-identical. Fetched at build time in v1 so the board works offline. |

## Gotchas worth knowing before editing

- **`next typegen` must run before `tsc`.** `layout.tsx` uses `LayoutProps<"/">`, a global that only
  exists after typegen writes `.next/types`, and `.next/` is gitignored. That is what
  `pretypecheck` is for. Declare page and route params by hand rather than using the generated
  `PageProps`.
- **The Neon HTTP driver is one statement per call.** Migrations use the WebSocket client in
  `db/migrate.ts`. Inside a migration file, order matters: `add constraint` validates existing rows
  immediately, so backfill `UPDATE`s must come first.
- **Adding a `session_events` type means editing two places**, the check constraint in `0001` and
  `EVENT_TYPES` in `lib/session/types.ts`. Before you do, read the note at the top of
  `lib/session/metrics.ts`: think time is read by array adjacency, and a new type in the wrong place
  silently zeroes it.
- **Top-level `await` fails under `tsx` for a `.ts` file.** Wrap in `main().catch(...)`, as
  `db/migrate.ts`, `evals/run.ts` and `bench/run.ts` all do.
- **ESLint enforces `react-hooks/set-state-in-effect`, `refs` and `immutability`.** Fix rather than
  suppress. `public/**` is ignored because the copied MediaPipe wasm glue is generated Emscripten
  output.
