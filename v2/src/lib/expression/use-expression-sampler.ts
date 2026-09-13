'use client'

// The capture loop.
//
// One interval that dispatches an action, which is the same shape as the clock in use-turn.ts:30.
// Effects in this codebase are for one-shot I/O; recurring work is an interval plus an action, and
// the reducer decides what a sample means.
//
// v1 put this in useEmotionCapture.ts behind four refs — enabledRef, serviceReadyRef,
// intervalRef, healthPollRef — plus emotionLogRef holding the accumulated samples, because the
// interval callback could not otherwise see current state. All of that is gone: there is no
// accumulator here at all. The window lives in the reducer, which is also why it survives a
// re-render and why clearing it is a state transition rather than a ref assignment.

import { useCallback, useEffect, useRef, useState } from 'react'

import { openCamera, stopTracks } from '@/lib/expression/camera'
import { loadLandmarker, sampleFrame } from '@/lib/expression/landmarker'
import { EXPRESSION_SAMPLE_MS } from '@/lib/turn/constants'
import type { TurnAction } from '@/lib/turn/types'

export type CameraStatus = 'off' | 'starting' | 'on' | 'denied' | 'unavailable'

/** What the camera attempt settled on. `starting` and `off` are derived from `active`, not stored,
 *  because storing them would mean writing state from an effect body for a value that is already
 *  implied by a prop. */
type CameraOutcome = 'on' | 'denied' | 'unavailable'

const isDenied = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'NotAllowedError' || error.name === 'SecurityError')

/**
 * `active` should be true exactly while a session is running. Turning it off stops the tracks,
 * which is what turns the browser's camera indicator off — v1 released the stream only when the
 * whole page unmounted.
 *
 * Every failure path lands on an outcome and nothing else. No camera means no samples, which means
 * `expression: null` on the wire, which means `emotionPart` drops out and the prompt is
 * byte-identical to a session without the feature. Degradation is the ordinary path here.
 */
export function useExpressionSampler(args: {
  readonly active: boolean
  readonly dispatch: (action: TurnAction) => void
}): { readonly videoRef: React.RefObject<HTMLVideoElement | null>; readonly status: CameraStatus } {
  const { active, dispatch } = args
  const [outcome, setOutcome] = useState<CameraOutcome | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(
    (video: HTMLVideoElement | null, isCancelled: () => boolean): Promise<MediaStream> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return Promise.reject(new Error('getUserMedia unavailable'))
      }
      return openCamera(video, isCancelled, {
        getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
        loadLandmarker,
      })
    },
    [],
  )

  useEffect(() => {
    if (!active) return

    // Captured here rather than read in the cleanup: by then React may have swapped the node.
    const video = videoRef.current
    let cancelled = false

    void start(video, () => cancelled)
      .then((stream) => {
        // A cancelled start still opened a camera. Close it rather than leaking the indicator.
        if (cancelled) {
          stopTracks(stream)
          return
        }
        streamRef.current = stream
        setOutcome('on')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.warn('[expression] camera unavailable:', error)
        setOutcome(isDenied(error) ? 'denied' : 'unavailable')
      })

    return () => {
      cancelled = true
      stopTracks(streamRef.current)
      streamRef.current = null
      if (video) video.srcObject = null
      setOutcome(null)
    }
  }, [active, start])

  const status: CameraStatus = active ? (outcome ?? 'starting') : 'off'

  useEffect(() => {
    if (status !== 'on') return

    let landmarker: Awaited<ReturnType<typeof loadLandmarker>> | null = null
    void loadLandmarker()
      .then((loaded) => {
        landmarker = loaded
      })
      .catch(() => {
        // Already surfaced by the start path; a second report here would be noise.
      })

    const id = setInterval(() => {
      const video = videoRef.current
      // HAVE_CURRENT_DATA. Sampling before the first frame decodes throws inside wasm.
      if (!landmarker || !video || video.readyState < 2) return

      // detectForVideo requires strictly increasing timestamps; performance.now() is monotonic
      // where Date.now() is not.
      const { signals, inferenceMs } = sampleFrame(landmarker, video, performance.now())

      // Two dispatches, because they answer two different questions. The cost is always recorded;
      // the sample only counts when a face was actually found, and the reducer additionally drops
      // it unless the learner is composing.
      dispatch({ type: 'FRAME_TIMED', ms: inferenceMs })
      if (signals) dispatch({ type: 'EXPRESSION_SAMPLED', signals, now: Date.now() })
    }, EXPRESSION_SAMPLE_MS)

    return () => clearInterval(id)
  }, [status, dispatch])

  return { videoRef, status }
}
