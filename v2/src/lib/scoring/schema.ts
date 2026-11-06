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
  // The only nullable dimension, and the only one that needs an OPPORTUNITY before it can be
  // observed at all. The other four are visible on every turn the learner takes; repair is visible
  // only once something has gone wrong. Forcing a number here made the rubric score the absence of
  // a breakdown as the absence of a skill — strong-03 scored a mean of 7/100 strategic in one
  // recorded eval run and 20/100 in the next, while scoring 84/75/89/82 elsewhere in both, and the
  // model's own summary for that fixture read "strategic repair skills were not
  // observed, as the interaction proceeded without misunderstandings". It was already producing the
  // concept in prose and being made to encode it as a near-zero that a radar renders as a clinical
  // claim about the learner. Null means no opportunity arose. A breakdown the learner failed to
  // repair is still a low number.
  strategic: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      'Repair and rephrasing when the NPC misunderstands or the plan fails. Null if nothing in ' +
        'the session ever gave the learner something to repair.',
    ),
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

/**
 * The mean of the dimensions that were actually observed.
 *
 * A not-observed dimension is skipped rather than counted as zero, because counting it would put
 * back exactly the distortion nullability removes. Null when nothing was observed at all.
 */
export const overallScore = (scores: CompetenceScoreResult): number | null => {
  const observed = SCORE_DIMENSIONS.map((key) => scores[key]).filter(
    (value): value is number => value !== null,
  )
  if (observed.length === 0) return null
  return observed.reduce((total, value) => total + value, 0) / observed.length
}
