// The scoring contract, enforced rather than requested.
//
// v1 asked for JSON in the prompt ("Return ONLY valid JSON with this exact structure"), stripped
// markdown fences by hand (main.py:786-789), then filled in whatever was missing:
//
//   operational=float(scores.get("operational", 50)),   # main.py:793-797, x5
//
// So a response of `{"summary": "..."}` with no numbers at all produced a complete, plausible,
// entirely fabricated 50/50/50/50/50 clinical score. It was written to the database, rendered on
// the therapist's radar chart with no marker that it was invented, and then fed back into the
// NEXT session's system prompt to calibrate difficulty (main.py:390-407).
//
// Here the schema is passed to the provider and validated on the way back. A response that does
// not satisfy it raises NoObjectGeneratedError, which classifies as `malformed_output` and
// results in no score at all. An absent score is recoverable; an invented one is not.

import { z } from 'zod'

const dimension = (description: string) => z.number().min(0).max(100).describe(description)

export const competenceScoresSchema = z.object({
  operational: dimension(
    'Use of the AAC board itself: icon choice, how icons are combined into a message.',
  ),
  linguistic: dimension('Vocabulary range, message length, grammatical structure of the icons.'),
  social: dimension('Appropriateness, turn-taking, social norms for this scenario.'),
  strategic: dimension('Repair and rephrasing when the NPC misunderstands or the plan fails.'),
  confidence: dimension('Fluency, initiative, consistency across the session.'),
  summary: z.string().min(1).describe('One or two sentences a therapist would find useful.'),
})

export type CompetenceScoreResult = z.infer<typeof competenceScoresSchema>

/** The five numeric dimensions, in the order the report renders them. */
export const SCORE_DIMENSIONS = [
  'operational',
  'linguistic',
  'social',
  'strategic',
  'confidence',
] as const

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number]

export const overallScore = (scores: CompetenceScoreResult): number =>
  SCORE_DIMENSIONS.reduce((total, key) => total + scores[key], 0) / SCORE_DIMENSIONS.length
