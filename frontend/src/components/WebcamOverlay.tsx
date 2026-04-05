'use client'

import { useEffect, useRef } from 'react'
import { EmotionResult } from '@/lib/expression'

const EMOTION_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fear: '😨',
  surprise: '😲',
  disgust: '🤢',
  neutral: '😐',
}

interface WebcamOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  currentEmotion: EmotionResult | null
  webcamActive: boolean
}

export default function WebcamOverlay({
  videoRef,
  canvasRef,
  currentEmotion,
  webcamActive,
}: WebcamOverlayProps) {
  const mediapipeInitRef = useRef(false)

  useEffect(() => {
    if (!webcamActive || mediapipeInitRef.current) return
    mediapipeInitRef.current = true

    let cameraInstance: { stop: () => void } | null = null

    async function initMediaPipe() {
      try {
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return

        const { FaceMesh } = await import('@mediapipe/face_mesh')
        const { Camera } = await import('@mediapipe/camera_utils')
        const { drawConnectors } = await import('@mediapipe/drawing_utils')
        // @ts-expect-error — mediapipe types don't export FACEMESH_TESSELATION cleanly
        const { FACEMESH_TESSELATION } = await import('@mediapipe/face_mesh')

        const faceMesh = new FaceMesh({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        })

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        faceMesh.onResults((results: any) => {
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (results.multiFaceLandmarks) {
            for (const landmarks of results.multiFaceLandmarks) {
              drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
                color: 'rgba(0, 255, 0, 0.25)',
                lineWidth: 1,
              })
            }
          }
        })

        const camera = new Camera(video, {
          onFrame: async () => {
            await faceMesh.send({ image: video })
          },
          width: 640,
          height: 480,
        })

        cameraInstance = camera
        camera.start()
      } catch (err) {
        console.warn('[WebcamOverlay] MediaPipe init error:', err)
      }
    }

    initMediaPipe()

    return () => {
      cameraInstance?.stop()
    }
  }, [webcamActive, videoRef, canvasRef])

  if (!webcamActive) return null

  const emoji = currentEmotion
    ? (EMOTION_EMOJI[currentEmotion.dominant_emotion] ?? '😐')
    : null

  return (
    <div className="relative w-[200px] h-[150px] rounded-lg overflow-hidden bg-black shadow-lg border border-gray-600">
      {/* Raw webcam feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        muted
        playsInline
      />
      {/* MediaPipe face mesh canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      {/* Hidden capture canvas (not rendered) */}
      {/* Emotion badge */}
      {emoji && (
        <div className="absolute bottom-1 right-1 text-xl leading-none bg-black/50 rounded px-1">
          {emoji}
        </div>
      )}
    </div>
  )
}
