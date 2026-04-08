import { EmotionLogEntry } from '@/hooks/useEmotionCapture'

const DIALOGUE_URL = process.env.NEXT_PUBLIC_DIALOGUE_URL || 'http://localhost:8001'

export interface EmotionSummary {
  summary_emotion: string
  explanation: string  // Short description of emotion progression
  avg_score: number
  duration_seconds: number
}

/**
 * Summarizes an emotion log using Claude API.
 * Feeds the full emotion progression to Claude to get intelligent analysis.
 * Example: neutral → angry (low) → angry (high) → frustrated
 */
export async function summarizeEmotionLog(
  log: EmotionLogEntry[]
): Promise<EmotionSummary | null> {
  if (log.length === 0) {
    return {
      summary_emotion: 'neutral',
      explanation: 'No emotions were captured.',
      avg_score: 0,
      duration_seconds: 0,
    }
  }

  // Calculate average score across all emotions and entries
  let totalScore = 0
  log.forEach((entry) => {
    const confidence = entry.emotion_result.scores[entry.emotion_result.dominant_emotion] || 0
    totalScore += confidence
  })
  const avgScore = totalScore / log.length

  // Build emotion progression for Claude analysis
  const emotionProgression = log.map((entry, idx) => {
    const emotion = entry.emotion_result.dominant_emotion
    const score = entry.emotion_result.scores[emotion]
    return `${idx + 1}. ${emotion.charAt(0).toUpperCase() + emotion.slice(1)} (confidence: ${Math.round(score)}%)`
  }).join('\n')

  try {
    const res = await fetch(`${DIALOGUE_URL}/summarize-emotion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emotion_log: emotionProgression,
      }),
    })

    if (!res.ok) {
      console.warn('[emotion-summary] API error, falling back to simple summary')
      return getFallbackSummary(log, avgScore)
    }

    const data = await res.json()
    const durationSeconds = (log[log.length - 1].timestamp - log[0].timestamp) / 1000

    return {
      summary_emotion: data.summary_emotion || 'neutral',
      explanation: data.explanation || 'Emotion analysis completed.',
      avg_score: Math.round(avgScore * 100) / 100,
      duration_seconds: Math.round(durationSeconds),
    }
  } catch (err) {
    console.warn('[emotion-summary] Error calling summarization API:', err)
    return getFallbackSummary(log, avgScore)
  }
}

function getFallbackSummary(
  log: EmotionLogEntry[],
  avgScore: number
): EmotionSummary {
  // Fallback: use most frequent emotion
  const emotionCounts: Record<string, number> = {}
  log.forEach((entry) => {
    const emotion = entry.emotion_result.dominant_emotion
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
  })

  const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) =>
    b[1] > a[1] ? b : a
  )[0]

  const durationSeconds = log.length > 1
    ? (log[log.length - 1].timestamp - log[0].timestamp) / 1000
    : 0

  return {
    summary_emotion: dominantEmotion || 'neutral',
    explanation: `The learner's dominant emotion was ${dominantEmotion || 'neutral'}.`,
    avg_score: Math.round(avgScore * 100) / 100,
    duration_seconds: Math.round(durationSeconds),
  }
}
