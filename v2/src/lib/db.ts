import { neon } from '@neondatabase/serverless'

// Neon's HTTP driver. No pool to exhaust and no connection to leak across function invocations,
// which is the usual way serverless Postgres goes wrong. Migrations use the WebSocket client
// instead (db/migrate.ts) because they need real multi-statement transactions.
//
// Lazily constructed so that importing this module does not throw at build time when
// DATABASE_URL is absent. v1 did `os.environ["ANTHROPIC_API_KEY"]` at import (main.py:29), which
// hard-crashes the process on a missing key with no useful message.

// Pinned to arrayMode=false, fullResults=false so queries resolve to plain row objects rather
// than the driver's union of every possible result shape.
type Sql = ReturnType<typeof neon<false, false>>

let client: Sql | null = null

export function db(): Sql {
  if (client) return client

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Locally: `vercel env pull v2/.env.local` from the repo root.',
    )
  }

  client = neon(url)
  return client
}
