// Applies db/migrations/*.sql in filename order, once each, tracked in _migrations.
// Run with: npm run db:migrate
//
// Deliberately not an ORM. Two tables do not justify a codegen step in the build.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, neonConfig } from '@neondatabase/serverless'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

// The request-path code uses neon()'s HTTP driver, which sends one statement per call. A
// migration file is many statements and must be atomic, so this script takes the WebSocket
// route instead. Node 22 has a global WebSocket, so no `ws` dependency is needed.
neonConfig.webSocketConstructor = globalThis.WebSocket as never

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Run `vercel env pull v2/.env.local` from the repo root.')
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) throw new Error(`No .sql files in ${MIGRATIONS_DIR}`)

  const client = new Client(url)
  await client.connect()

  try {
    await client.query(`
      create table if not exists _migrations (
        name       text        primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const { rows } = await client.query<{ name: string }>('select name from _migrations')
    const applied = new Set(rows.map((row) => row.name))

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`)
        continue
      }

      const statements = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(statements)
        await client.query('insert into _migrations (name) values ($1)', [file])
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw new Error(`${file} failed: ${error instanceof Error ? error.message : error}`)
      }
      console.log(`apply ${file}`)
      ran++
    }

    console.log(ran === 0 ? 'up to date' : `applied ${ran} migration(s)`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
