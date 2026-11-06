// Turns a session's event log into something a scorer can actually reason about.
//
// This is a deliberate divergence from the port, and the reason is worth stating plainly.
//
// v1 built the scorer's transcript in the browser, at
// frontend/src/app/therapist/sessions/[sessionId]/page.tsx:212-240:
//
//   role:    e.event_type === 'icon_selection' ? 'user' : 'assistant',
//   content: e.event_type === 'icon_selection' ? e.payload.translated : e.payload.content ?? '',
//
// Two consequences, both confirmed:
//
//  1. The role is a binary else, so a `heart_lost` event became an ASSISTANT turn with empty
//     content. In survival mode the transcript was corrupted in a way the scorer could not see.
//  2. Everything except the translated prose was discarded — the icons array, turn_index,
//     response_latency_ms, is_repair. The scorer was then asked to grade "icon selection
//     accuracy", "grammatical structure in icon combinations", "response speed indicators" and
//     "use of repair strategies" from fully translated English with the icons stripped out.
//
// Four of the five dimensions were unscoreable in principle. Porting that forward would mean the
// eval set characterises a scorer that cannot see its own inputs, so the transcript is rebuilt
// here instead: icons alongside the translation, turn index carried, hearts lost recorded as
// annotations rather than as empty NPC turns.

import type { SessionEventRow } from '@/lib/session/types'

export interface LearnerTurn {
  readonly role: 'learner'
  readonly turnIndex: number
  /** What the learner actually selected, which is the AAC evidence. */
  readonly icons: readonly string[]
  /** What translateIcons made of it. v1 sent only this. */
  readonly translated: string
  readonly npcInitiated: boolean
}

export interface NpcTurn {
  readonly role: 'npc'
  readonly turnIndex: number
  readonly content: string
  readonly npcEmotion: string
}

export interface HeartLostNote {
  readonly role: 'note'
  readonly reason: string
}

export type ScoringTurn = LearnerTurn | NpcTurn | HeartLostNote

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : -1)

const asStrings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export function buildScoringTranscript(events: readonly SessionEventRow[]): ScoringTurn[] {
  const turns: ScoringTurn[] = []

  for (const event of events) {
    const payload = event.payload

    switch (event.type) {
      case 'icon_selection':
        turns.push({
          role: 'learner',
          turnIndex: asNumber(payload.turnIndex),
          icons: asStrings(payload.icons),
          translated: asString(payload.translated),
          npcInitiated: payload.npcInitiated === true,
        })
        break

      case 'npc_response':
        turns.push({
          role: 'npc',
          turnIndex: asNumber(payload.turnIndex),
          content: asString(payload.content),
          npcEmotion: asString(payload.npcEmotion, 'neutral'),
        })
        break

      case 'heart_lost':
        // v1 turned this into an empty assistant turn. It is not dialogue; it is context.
        turns.push({ role: 'note', reason: asString(payload.reason, 'unknown') })
        break

      // session_start and session_end carry no dialogue and are deliberately dropped.
      default:
        break
    }
  }

  return turns
}

/** How many real learner turns the session contains. Used to refuse to score an empty session. */
export const countLearnerTurns = (turns: readonly ScoringTurn[]): number =>
  turns.filter((turn) => turn.role === 'learner').length

/**
 * Renders the transcript for the prompt. The icon array is shown next to the translation so the
 * model can see the AAC construction it is being asked to grade, not just its English rendering.
 */
export function renderScoringTranscript(turns: readonly ScoringTurn[]): string {
  return turns
    .map((turn) => {
      if (turn.role === 'note') return `[heart lost: ${turn.reason}]`
      if (turn.role === 'npc') return `NPC (${turn.npcEmotion}): ${turn.content}`

      const icons = turn.icons.length > 0 ? turn.icons.join(' + ') : '(none)'
      const prefix = turn.npcInitiated ? 'Learner (prompted)' : 'Learner'
      return `${prefix} [icons: ${icons}]: ${turn.translated}`
    })
    .join('\n')
}
