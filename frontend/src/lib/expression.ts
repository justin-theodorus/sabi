const EXPRESSION_URL =
  process.env.NEXT_PUBLIC_EXPRESSION_URL || 'http://localhost:8003'

export interface EmotionResult {
  dominant_emotion: 'happy' | 'sad' | 'angry' | 'fear' | 'surprise' | 'disgust' | 'neutral'
  scores: Record<string, number>
}

/**
 * Send a JPEG frame blob to the expression service for emotion analysis.
 * Returns null on any error — expression failure must never interrupt the session.
 */
export async function analyzeFrame(blob: Blob): Promise<EmotionResult | null> {
  try {
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    const res = await fetch(`${EXPRESSION_URL}/analyze-frame`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) return null
    return (await res.json()) as EmotionResult
  } catch {
    return null
  }
}

/**
 * Poll the expression service health endpoint. Resolves true when ready.
 */
export async function checkExpressionHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${EXPRESSION_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}
