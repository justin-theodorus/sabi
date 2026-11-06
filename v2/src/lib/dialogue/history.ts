import type { ModelMessage } from 'ai'

import type { SessionEventRow } from '@/lib/session/types'

/**
 * Rebuilds the conversation from the event log.
 *
 * The log is the transcript. v1 had no server-side transcript at all: `history` was a useState
 * array in the browser (session/page.tsx:239) sent in full to the engine on every turn (:558),
 * so the authoritative conversation state was the browser tab and a refresh lost it entirely.
 * It was also unbounded, which is half of finding S5 — and the load test truncated to the last
 * six messages (locustfile.py:158), so the only thing that ever measured this exercised a
 * bounded prompt the real client never sent.
 *
 * Here the cap is applied by the query that feeds this (loadHistory), server-side, where a
 * client cannot opt out of it.
 */
export function toModelMessages(events: readonly SessionEventRow[]): ModelMessage[] {
  return events.flatMap((event): ModelMessage[] => {
    if (event.type === 'icon_selection') {
      const text = String(event.payload.translated ?? '').trim()
      return text ? [{ role: 'user', content: text }] : []
    }

    if (event.type === 'npc_response') {
      const text = String(event.payload.content ?? '').trim()
      // A blank assistant turn is dropped rather than sent. v1 appended '' to history whenever a
      // stream failed silently (finding 3.1) and that empty turn then corrupted the context of
      // every subsequent turn. v2 never writes one, but reading defensively costs nothing.
      return text ? [{ role: 'assistant', content: text }] : []
    }

    return []
  })
}

/** main.py:549 — an empty learner turn is labelled, not sent as an empty string. */
export const SILENCE_PLACEHOLDER = '[silence — learner has not responded]'
