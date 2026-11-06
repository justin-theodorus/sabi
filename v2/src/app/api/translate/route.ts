import { NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError, parseBody } from '@/lib/http'
import { translateIcons } from '@/lib/translate'

export const runtime = 'nodejs'

const MAX_ICONS = 12
const MAX_LABEL_LENGTH = 40

const bodySchema = z.object({
  icons: z.array(z.string().min(1).max(MAX_LABEL_LENGTH)).min(1).max(MAX_ICONS),
})

/**
 * Icon labels to a natural-language sentence. Pure, no I/O, no session.
 *
 * The response key is `text`, matching v1 (aac-icon-service/index.js:80). The load test reads
 * `translation` (tests/locust/locustfile.py:277), a key the service never returned, so every run
 * silently fell back to `" ".join(icons)` and the translate leg was timed but its output
 * discarded. That is the caller's defect; changing the contract to match a broken caller would
 * be the wrong repair. Tracked in BACKLOG.md for the Phase 5 load-test rewrite.
 *
 * /api/dialogue does not call this over HTTP. It calls translateIcons() directly — the network
 * hop was the finding, not the feature.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, bodySchema)
  if (!body.ok) return jsonError(400, 'icons must be a non-empty array')

  return NextResponse.json({ text: translateIcons(body.data.icons) })
}
