'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmotionEvent {
  id: string
  session_offset_ms: number
  dominant_emotion: string
  scores: Record<string, number>
}

interface SessionEvent {
  id: string
  event_type: string
  payload: Record<string, unknown>
  timestamp: string
}

interface SessionMeta {
  id: string
  started_at: string
  duration_seconds: number | null
  scenario_id: string
  mode: string
  video_url: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const EMOTION_EMOJI: Record<string, string> = {
  happy: '😊', sad: '😢', angry: '😠',
  fear: '😨', surprise: '😲', disgust: '🤢', neutral: '😐',
}

const EMOTION_COLOR: Record<string, string> = {
  happy: '#4ade80', sad: '#60a5fa', angry: '#f87171',
  fear: '#c084fc', surprise: '#fbbf24', disgust: '#a3e635', neutral: '#94a3b8',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecordingPage() {
  const router = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()

  const videoRef = useRef<HTMLVideoElement>(null)
  const pipRef = useRef<HTMLVideoElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const [authToken, setAuthToken] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [emotionEvents, setEmotionEvents] = useState<EmotionEvent[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [session, setSession] = useState<SessionMeta | null>(null)
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral')
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [activeEventIdx, setActiveEventIdx] = useState(-1)
  const [pipEnabled, setPipEnabled] = useState(false)
  const [pipStream, setPipStream] = useState<MediaStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: auth } }) => {
      if (!auth) { router.push('/'); return }
      if (auth.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      setAuthToken(auth.access_token)
    })
  }, [router])

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authToken || !sessionId) return

    async function load() {
      try {
        const [sessionRes, emotionRes, eventsRes] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, started_at, duration_seconds, scenario_id, mode, video_url')
            .eq('id', sessionId)
            .single(),
          supabase
            .from('emotion_events')
            .select('id, session_offset_ms, dominant_emotion, scores')
            .eq('session_id', sessionId)
            .order('session_offset_ms', { ascending: true }),
          supabase
            .from('session_events')
            .select('id, event_type, payload, timestamp')
            .eq('session_id', sessionId)
            .in('event_type', ['icon_selection', 'npc_response'])
            .order('timestamp', { ascending: true }),
        ])

        if (sessionRes.error) throw new Error(sessionRes.error.message)
        const sessionData = sessionRes.data as SessionMeta
        setSession(sessionData)
        setEmotionEvents((emotionRes.data ?? []) as EmotionEvent[])
        setSessionEvents((eventsRes.data ?? []) as SessionEvent[])

        if (sessionData.video_url) {
          // Fetch video as a blob and create a local object URL.
          // This avoids all Range-request and CORS complexity with the <video> element.
          setVideoLoading(true)
          const streamUrl = `${SESSION_URL}/sessions/${sessionId}/video-stream`
          console.log('[recording] Fetching video from', streamUrl)
          const videoRes = await fetch(streamUrl)
          if (!videoRes.ok) throw new Error(`Video fetch failed: ${videoRes.status}`)

          const contentLength = parseInt(videoRes.headers.get('Content-Length') || '0', 10)
          const reader = videoRes.body!.getReader()
          const chunks: BlobPart[] = []
          let received = 0

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            if (contentLength > 0) setVideoProgress(Math.round((received / contentLength) * 100))
          }

          const blob = new Blob(chunks, { type: 'video/webm' })
          console.log('[recording] Video blob ready:', (blob.size / 1024 / 1024).toFixed(1), 'MB')
          setVideoUrl(URL.createObjectURL(blob))
          setVideoLoading(false)
        } else {
          setError('No recording found for this session.')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load recording')
        setVideoLoading(false)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [authToken, sessionId])

  // ── Event offsets (ms from session start) ────────────────────────────────

  const eventOffsets = useMemo(() => {
    if (!session) return []
    const start = new Date(session.started_at).getTime()
    return sessionEvents.map(e => ({
      ...e,
      offset_ms: Math.max(0, new Date(e.timestamp).getTime() - start),
    }))
  }, [session, sessionEvents])

  // ── Video sync ────────────────────────────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    const ms = videoRef.current.currentTime * 1000
    setCurrentTimeMs(ms)

    // Find closest emotion event within ±1000ms window
    let closest: EmotionEvent | null = null
    let closestDist = Infinity
    for (const e of emotionEvents) {
      const dist = Math.abs(e.session_offset_ms - ms)
      if (dist < closestDist && dist < 1000) {
        closest = e
        closestDist = dist
      }
    }
    if (closest) setCurrentEmotion(closest.dominant_emotion)

    // Find active transcript event (last event whose offset is ≤ currentTime)
    for (let i = eventOffsets.length - 1; i >= 0; i--) {
      if (eventOffsets[i].offset_ms <= ms) {
        setActiveEventIdx(i)
        break
      }
    }
  }, [emotionEvents, eventOffsets])

  // ── Auto-scroll transcript to active event ───────────────────────────────

  useEffect(() => {
    if (activeEventIdx < 0 || !transcriptRef.current) return
    const el = transcriptRef.current.querySelector(`[data-idx="${activeEventIdx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeEventIdx])

  // ── Seek to offset ────────────────────────────────────────────────────────

  function seekToOffset(ms: number) {
    if (!videoRef.current) return
    videoRef.current.currentTime = ms / 1000
  }

  // ── Therapist PiP webcam ──────────────────────────────────────────────────

  async function togglePip() {
    if (pipEnabled) {
      pipStream?.getTracks().forEach(t => t.stop())
      setPipStream(null)
      setPipEnabled(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (pipRef.current) pipRef.current.srcObject = stream
        setPipStream(stream)
        setPipEnabled(true)
      } catch {
        alert('Camera permission denied. Please allow camera access.')
      }
    }
  }

  useEffect(() => {
    return () => { pipStream?.getTracks().forEach(t => t.stop()) }
  }, [pipStream])

  // Revoke blob URL on unmount to free memory
  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  // ── Emotion timeline segments ─────────────────────────────────────────────

  const totalMs = (session?.duration_seconds ?? 0) * 1000 || 1

  const timelineSegments = useMemo(() => {
    return emotionEvents.map((e, i) => {
      const next = emotionEvents[i + 1]
      const width = next
        ? ((next.session_offset_ms - e.session_offset_ms) / totalMs) * 100
        : ((totalMs - e.session_offset_ms) / totalMs) * 100
      return { ...e, widthPct: Math.max(width, 0.05) }
    })
  }, [emotionEvents, totalMs])

  const progressPct = Math.min((currentTimeMs / totalMs) * 100, 100)

  // ── Emotion legend (only emotions that appear in this session) ────────────

  const presentEmotions = useMemo(() => {
    const seen = new Set(emotionEvents.map(e => e.dominant_emotion))
    return Object.entries(EMOTION_COLOR).filter(([emo]) => seen.has(emo))
  }, [emotionEvents])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading recording…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Link
          href={`/therapist/sessions/${sessionId}`}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          ← Back to Report
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center gap-4">
        <Link
          href={`/therapist/sessions/${sessionId}`}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back to Report
        </Link>
        <div className="w-px h-5 bg-gray-600" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">▶</span>
          </div>
          <h1 className="text-lg font-bold">Session Recording</h1>
        </div>
        <div className="ml-auto">
          <button
            onClick={togglePip}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              pipEnabled
                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            {pipEnabled ? '📷 Camera on' : '📷 Enable camera'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Video + timeline ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Video player */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              {videoLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
                  <div className="text-white text-sm font-medium">Loading recording…</div>
                  <div className="w-48 bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                  <div className="text-gray-400 text-xs">{videoProgress}%</div>
                </div>
              )}
              <video
                ref={videoRef}
                src={videoUrl ?? undefined}
                controls
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onError={(e) => {
                  const v = e.currentTarget
                  console.error('[video] load error', v.error?.code, v.error?.message, 'src=', v.src)
                  setError(`Video failed to load (code ${v.error?.code ?? '?'}). Check console for details.`)
                }}
              />

              {/* Emotion badge — bottom-left */}
              <div className="absolute bottom-12 left-3 bg-black/70 rounded-full px-3 py-1.5 flex items-center gap-2 text-sm backdrop-blur-sm pointer-events-none">
                <span className="text-xl">{EMOTION_EMOJI[currentEmotion] ?? '😐'}</span>
                <span className="text-gray-200 capitalize">{currentEmotion}</span>
              </div>

              {/* Therapist PiP webcam */}
              {pipEnabled && (
                <video
                  ref={pipRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute top-3 right-3 w-36 h-24 rounded-lg border border-gray-600 object-cover shadow-lg"
                />
              )}
            </div>

            {/* Emotion timeline strip */}
            {emotionEvents.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Emotion Timeline
                </div>
                <div
                  className="relative h-6 rounded-lg overflow-hidden cursor-pointer flex bg-gray-800"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = (e.clientX - rect.left) / rect.width
                    seekToOffset(pct * totalMs)
                  }}
                >
                  {timelineSegments.map((seg) => (
                    <div
                      key={seg.id}
                      style={{
                        width: `${seg.widthPct}%`,
                        backgroundColor: EMOTION_COLOR[seg.dominant_emotion] ?? '#94a3b8',
                        opacity: 0.85,
                      }}
                      title={`${seg.dominant_emotion} @ ${(seg.session_offset_ms / 1000).toFixed(1)}s`}
                    />
                  ))}
                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm pointer-events-none"
                    style={{ left: `${progressPct}%` }}
                  />
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3">
                  {presentEmotions.map(([emo, color]) => (
                    <div key={emo} className="flex items-center gap-1 text-xs text-gray-400">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize">{EMOTION_EMOJI[emo]} {emo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {emotionEvents.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                No emotion data recorded for this session.
              </div>
            )}
          </div>

          {/* ── Right: Transcript ── */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col max-h-[calc(100vh-12rem)]">
            <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-sm font-semibold">Transcript</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {eventOffsets.length} exchanges · click to seek
              </p>
            </div>
            <div
              ref={transcriptRef}
              className="flex-1 overflow-y-auto p-4 space-y-2"
            >
              {eventOffsets.map((e, i) => {
                const isLearner = e.event_type === 'icon_selection'
                const isActive = i === activeEventIdx
                const text = isLearner
                  ? `${(e.payload.translated as string) ?? ''} ${
                      (e.payload.icons as string[])?.map((ic: string) => `[${ic}]`).join(' ') ?? ''
                    }`.trim()
                  : (e.payload.content as string) ?? ''

                return (
                  <div
                    key={e.id}
                    data-idx={i}
                    className={`flex ${isLearner ? 'justify-start' : 'justify-end'} cursor-pointer`}
                    onClick={() => seekToOffset(e.offset_ms)}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-xs transition-all duration-150 ${
                        isActive
                          ? isLearner
                            ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                            : 'bg-gray-400 text-gray-900 ring-2 ring-gray-200'
                          : isLearner
                            ? 'bg-blue-900/60 text-blue-100 rounded-bl-sm'
                            : 'bg-gray-700 text-gray-200 rounded-br-sm'
                      }`}
                    >
                      <div className="opacity-60 text-[10px] mb-0.5">
                        {isLearner ? '🧑 Learner' : '🤖 NPC'} · {(e.offset_ms / 1000).toFixed(1)}s
                      </div>
                      {text}
                    </div>
                  </div>
                )
              })}
              {eventOffsets.length === 0 && (
                <div className="text-gray-500 text-xs text-center py-8">
                  No transcript events recorded.
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
