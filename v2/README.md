# SABI v2

The single-app rebuild of SABI. One Next.js app, no gateway, no queue, no containers.
The v1 microservice stack it replaces is still in this repository, one level up, and
still runs via `docker compose up`.

Vercel deploys this directory: the project's Root Directory is set to `v2`.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
```

## Copied from v1, unchanged

| Path | From | Note |
|---|---|---|
| `src/app/globals.css` | `frontend/src/app/globals.css` | Design tokens and the SF Rounded stack. The three `@tailwind` directives and the one `@apply` rule were expanded to plain CSS; v2 has no Tailwind, and nothing copied used a utility class. |
| `src/components/AACBoard.tsx` | `frontend/src/components/AACBoard.tsx` | Byte-identical. The `ICONS` table holds 128 entries across three categories. |
| `public/icons/` | `frontend/public/icons/` | 318 ARASAAC pictograms, byte-identical. Fetched at build time in v1 so the board works offline. |

## Status

Phase 0 of the rebuild plan: the board renders, and there is no backend behind it.
