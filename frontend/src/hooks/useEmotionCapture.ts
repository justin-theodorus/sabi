'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { analyzeFrame, checkExpressionHealth, EmotionResult } from '@/lib/expression'

const SESSION_URL =
  process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

interface UseEmotionCaptureOptions {
  sessionId: string | null
  token: string | null
  sessionStartTime: number  // Date.now() at session start
  captureFrame: () => Promise<Blob | null>
  enabled: boolean
}

/**
 * Polls the expression service every 500ms, logs emotion events to the session service.
 * Returns the latest detected emotion for live UI display.
 * All errors are swallowed — emotion failure must never disrupt the learner session.
 */
export function useEmotionCapture({
  sessionId,
  token,
  sessionStartTime,
  captureFrame,
  enabled,
}: UseEmotionCaptureOptions): EmotionResult | null {
  const [currentEmotion, setCurrentEmotion] = useState<EmotionResult | null>(null)
  const enabledRef = useRef(enabled)
  const serviceReadyRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep ref in sync so the interval closure always sees latest value
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const logEmotion = useCallback(
    async (result: EmotionResult, offsetMs: number) => {
      if (!sessionId || !token) return
      try {
        await fetch(`${SESSION_URL}/sessions/${sessionId}/emotions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_offset_ms: offsetMs,
            dominant_emotion: result.dominant_emotion,
            scores: result.scores,
          }),
        })
      } catch {
        // Silently swallow — emotion logging is best-effort
      }
    },
    [sessionId, token]
  )

  const runCapture = useCallback(async () => {
    if (!enabledRef.current || !serviceReadyRef.current) return
    const blob = await captureFrame()
    if (!blob) return
    const result = await analyzeFrame(blob)
    if (!result) return
    setCurrentEmotion(result)
    const offsetMs = Date.now() - sessionStartTime
    await logEmotion(result, offsetMs)
  }, [captureFrame, sessionStartTime, logEmotion])

  useEffect(() => {
    if (!enabled) {
      // Clean up on disable
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (healthPollRef.current) clearInterval(healthPollRef.current)
      intervalRef.current = null
      healthPollRef.current = null
      serviceReadyRef.current = false
      return
    }

    // Poll health every 2s until the expression service is ready, then start capture loop
    healthPollRef.current = setInterval(async () => {
      if (serviceReadyRef.current) return
      const ready = await checkExpressionHealth()
      if (ready) {
        serviceReadyRef.current = true
        if (healthPollRef.current) clearInterval(healthPollRef.current)
        // Start 500ms emotion capture interval
        intervalRef.current = setInterval(runCapture, 500)
      }
    }, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (healthPollRef.current) clearInterval(healthPollRef.current)
    }
  }, [enabled, runCapture])

  return currentEmotion
}
