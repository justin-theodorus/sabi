'use client'

import { useRef, useCallback } from 'react'

export interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  captureFrameRef: React.RefObject<HTMLCanvasElement>
  startWebcam: () => Promise<boolean>
  stopWebcam: () => void
  captureFrame: () => Promise<Blob | null>
  startRecording: () => void
  stopRecording: () => Promise<Blob | null>
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const canvasRef = useRef<HTMLCanvasElement>(null!)
  const captureFrameRef = useRef<HTMLCanvasElement>(null!)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startWebcam = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      return true
    } catch (err) {
      console.warn('[useWebcam] getUserMedia denied or unavailable:', err)
      return false
    }
  }, [])

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    const canvas = captureFrameRef.current
    if (!video || !canvas || !streamRef.current) return null
    if (video.readyState < 2) return null

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7)
    })
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'
    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(1000) // collect data every 1s
      recorderRef.current = recorder
    } catch (err) {
      console.warn('[useWebcam] MediaRecorder error:', err)
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        chunksRef.current = []
        recorderRef.current = null
        resolve(blob.size > 0 ? blob : null)
      }
      recorder.stop()
    })
  }, [])

  return {
    videoRef,
    canvasRef,
    captureFrameRef,
    startWebcam,
    stopWebcam,
    captureFrame,
    startRecording,
    stopRecording,
  }
}
