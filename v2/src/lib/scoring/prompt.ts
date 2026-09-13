// The scoring prompt.
//
// Ported from v1 (dialogue-engine/main.py:752-775) with one substantive addition: band anchors.
//
// v1 gave a one-line gloss per dimension, said "0-100 each", and stopped. There was nothing to
// disagree with, which is another way of saying there was nothing to evaluate — two runs over the
// same transcript could differ by forty points and neither would be wrong. The anchors below are
// what the eval suite's ordering and separation assertions are actually testing against.

import { SCENARIO_DESCRIPTIONS } from '@/lib/prompt/constants'
import type { ScenarioId } from '@/lib/prompt/types'
import { renderScoringTranscript, type ScoringTurn } from '@/lib/scoring/transcript'

const BANDS = `Use the full range. The bands mean:
  0-20   absent: no evidence of this skill anywhere in the session
  21-40  emerging: attempted once or twice, mostly unsuccessful
  41-60  inconsistent: works sometimes, breaks down under pressure
  61-80  competent: reliable across the session with minor lapses
  81-100 fluent: consistent, flexible, and adapts when something goes wrong

Score each dimension independently. A learner can be fluent socially and absent strategically.
Do not converge on the middle to be safe: a session with no repair attempts scores low on
strategic even if everything else went well.`

const DIMENSIONS = `- operational: use of the AAC board. Icon choice, how icons combine into a
  message, whether the selection matches the intent. The [icons: ...] list is the evidence.
- linguistic: vocabulary range, message length, grammatical structure of the icon combinations.
  Judge the icons, not the English translation, which was generated for you.
- social: appropriateness of the responses, turn-taking, adherence to the social norms of this
  scenario.
- strategic: repair strategies. Rephrasing after a misunderstanding, compensating when the NPC
  does not follow, recovering from a breakdown.
- confidence: fluency, initiative-taking, consistency across the session.`

export interface ScoringPromptInput {
  readonly scenarioId: ScenarioId
  readonly turns: readonly ScoringTurn[]
  readonly emotionSummary?: string | null
}

export const SCORING_INSTRUCTIONS =
  'You are an AAC (Augmentative and Alternative Communication) specialist scoring a learner ' +
  'communication session. You are precise, you use the whole scale, and you never invent ' +
  'evidence that is not in the transcript.'

export function buildScoringPrompt(input: ScoringPromptInput): string {
  return [
    `Scenario: ${SCENARIO_DESCRIPTIONS[input.scenarioId]}`,
    `Observed learner emotion: ${input.emotionSummary || 'Not available'}`,
    '',
    'Session transcript. Each learner line shows the icons selected and the sentence they were',
    'translated into. `[heart lost: ...]` marks a penalty, not something anyone said.',
    '',
    renderScoringTranscript(input.turns),
    '',
    'Score the learner across these five AAC communication competence dimensions:',
    DIMENSIONS,
    '',
    BANDS,
  ].join('\n')
}
