'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendDialogue, judgeResponse, type Message } from '@/lib/dialogue'
import { summarizeEmotionLog } from '@/lib/emotion-summary'
import { translateIcons } from '@/lib/aac-translate'
import { startSession, endSession, logEvent } from '@/lib/session'
import { uploadSessionVideo } from '@/lib/minio-upload'
import { SCENARIOS } from '@/lib/scenarios'
import { useWebcam } from '@/hooks/useWebcam'
import { useEmotionCapture } from '@/hooks/useEmotionCapture'
import ScenarioStage from '@/components/ScenarioStage'
import AACBoard, { type AACIcon } from '@/components/AACBoard'
import MessageBar from '@/components/MessageBar'
import HeartsBar from '@/components/HeartsBar'
import SabiHintBar from '@/components/SabiHintBar'

// Dynamic import avoids SSR crash from MediaPipe browser APIs
const WebcamOverlay = dynamic(() => import('@/components/WebcamOverlay'), { ssr: false })

const SURVIVAL_TIMEOUT_MS = 30_000
const MAX_HEARTS = 5

// Default to hawker centre; can be extended to read from sessionStorage/URL params
const scenario = SCENARIOS.hawker_centre

function playAudio(base64: string) {
  try {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`)
    audio.play().catch(() => {})
  } catch {}
}

/**
 * Reads moodAnswers from sessionStorage (written by mood/page.tsx) and maps
 * them to a concise NPC tone instruction injected into the dialogue system prompt.
 */
function buildMoodModifier(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('moodAnswers')
    if (!raw) return null
    const answers: Record<string, string> = JSON.parse(raw)

    const parts: string[] = ['Adjust your tone based on the learner\'s current state:']

    const moodMap: Record<string, string> = {
      'Happy':   'The learner is happy and upbeat — match their energy with warmth and enthusiasm.',
      'Okay':    'The learner is in a neutral mood — keep your tone steady and supportive.',
      'Tired':   'The learner is feeling tired — be extra patient, keep responses brief and low-pressure.',
      'Nervous': 'The learner is feeling nervous — be especially gentle, reassuring, and encouraging.',
    }
    if (answers.mood && moodMap[answers.mood]) parts.push(moodMap[answers.mood])

    const energyMap: Record<string, string> = {
      'I want to try everything, even if I fail!':              'They are eager to experiment — encourage all attempts even if imperfect.',
      "I'd prefer to get it right the first time; let's go slow.": 'They prefer a careful, slow pace — do not rush them.',
      'Mistakes are just obstacles to smash through!':          'They have a bold, resilient attitude — keep the energy high.',
    }
    if (answers.energy && energyMap[answers.energy]) parts.push(energyMap[answers.energy])

    const volumeMap: Record<string, string> = {
      "I'm ready to shout the answers!":          'They are highly engaged and participative today.',
      "I'd rather just observe and type quietly.": 'They prefer a quieter pace — give them extra time to respond.',
      "I'm here for a deep, serious discussion.":  'They are in a focused, serious mood — match that gravitas.',
    }
    if (answers.volume && volumeMap[answers.volume]) parts.push(volumeMap[answers.volume])

    const vibeMap: Record<string, string> = {
      'Exploring and playing around.':      'They want a playful, exploratory session — keep it light and fun.',
      'Deep focus and mastery.':            'They want focused, meaningful practice — be precise and purposeful.',
      'Just getting through it comfortably': 'They want a comfortable, low-stress session — be warm and easy-going.',
    }
    if (answers.vibe && vibeMap[answers.vibe]) parts.push(vibeMap[answers.vibe])

    return parts.length > 1 ? parts.join(' ') : null
  } catch {
    return null
  }
}

export default function PracticePage() {
  const router = useRouter()

  // Auth
  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [persona, setPersona] = useState<string>('guided_learner')

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mode] = useState<'learning' | 'survival'>('learning')
  const [moodModifier] = useState<string | null>(() => buildMoodModifier())

  // Gameplay state
  const [selectedIcons, setSelectedIcons] = useState<AACIcon[]>([])
  const [npcResponse, setNpcResponse] = useState<string | null>(scenario.npcGreeting)
  const [npcEmotion, setNpcEmotion] = useState<string | undefined>(undefined)
  const [npcLoading, setNpcLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [sessionOver, setSessionOver] = useState(false)

  // Webcam / recording
  const [webcamActive, setWebcamActive] = useState(false)
  const sessionStartTimeRef = useRef<number>(0)

  // Metrics for persona classification
  const messageStartTimeRef = useRef<number | null>(null)
  const latencySamplesRef = useRef<number[]>([])
  const iconCountSamplesRef = useRef<number[]>([])

  // Survival timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { videoRef, canvasRef, captureFrameRef, startWebcam, stopWebcam, captureFrame, startRecording, stopRecording } =
    useWebcam()

  const { currentEmotion, getEmotionLog, resetEmotionLog } = useEmotionCapture({
    sessionId,
    token: authToken,
    sessionStartTime: sessionStartTimeRef.current,
    captureFrame,
    enabled: !sessionOver && webcamActive,
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setAuthToken(session.access_token)
      setUserId(session.user.id)

      const { data } = await supabase
        .from('learner_profiles')
        .select('persona')
        .eq('user_id', session.user.id)
        .single()
      if (data?.persona) setPersona(data.persona)

      setAuthChecked(true)
    })
  }, [router])

  // ── Session start ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authChecked || !authToken) return

    async function init() {
      try {
        const id = await startSession(authToken!, scenario.id, mode, persona)
        setSessionId(id)
      } catch {
        // Continue without session logging if service unavailable
      }

      sessionStartTimeRef.current = Date.now()
      messageStartTimeRef.current = Date.now()
      const camOk = await startWebcam()
      if (camOk) {
        startRecording()
        setWebcamActive(true)
      }

      if (mode === 'survival') startSurvivalTimer()
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked])

  // ── Survival timer ────────────────────────────────────────────────────────

  const deductHeart = useCallback(async (reason: 'timeout' | 'off_context') => {
    setHearts((prev) => {
      const next = prev - 1
      if (next <= 0) endSessionFlow(0)
      return next
    })
    if (sessionId && authToken) {
      await logEvent(authToken, sessionId, 'heart_lost', { reason })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authToken])

  function startSurvivalTimer() {
    clearSurvivalTimer()
    timeoutRef.current = setTimeout(() => deductHeart('timeout'), SURVIVAL_TIMEOUT_MS)
  }

  function clearSurvivalTimer() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  useEffect(() => () => clearSurvivalTimer(), [])

  // ── Session end ───────────────────────────────────────────────────────────

  async function endSessionFlow(finalHearts: number) {
    clearSurvivalTimer()
    setSessionOver(true)

    stopWebcam()
    setWebcamActive(false)

    if (sessionId && authToken) {
      stopRecording().then(async (blob) => {
        if (blob) await uploadSessionVideo(authToken!, sessionId!, blob)
      }).catch(() => {})

      await endSession(authToken, sessionId, finalHearts)
    }

    // Post-session persona classification
    if (userId && latencySamplesRef.current.length > 0) {
      const avg_latency =
        latencySamplesRef.current.reduce((a, b) => a + b, 0) / latencySamplesRef.current.length
      const avg_icons =
        iconCountSamplesRef.current.length > 0
          ? iconCountSamplesRef.current.reduce((a, b) => a + b, 0) / iconCountSamplesRef.current.length
          : 2

      try {
        const personaRes = await fetch(
          (process.env.NEXT_PUBLIC_PERSONA_URL || 'http://localhost:8002') + '/classify',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              avg_response_latency_ms: avg_latency,
              re_prompt_count: 0,
              avg_icons_per_message: avg_icons,
            }),
          }
        )
        if (personaRes.ok) {
          const { persona: newPersona } = await personaRes.json()
          setPersona(newPersona)
          await fetch(
            (process.env.NEXT_PUBLIC_PERSONA_URL || 'http://localhost:8002') + `/profile/${userId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ persona: newPersona, avg_response_latency_ms: avg_latency }),
            }
          )
        }
      } catch {}
    }
  }

  // ── Icon selection ────────────────────────────────────────────────────────

  function handleIconSelect(icon: AACIcon) {
    setSelectedIcons((prev) => [...prev, icon])
  }

  function handleRemoveIcon(index: number) {
    setSelectedIcons((prev) => prev.filter((_, i) => i !== index))
  }

  function handleClear() {
    setSelectedIcons([])
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (selectedIcons.length === 0 || npcLoading || sessionOver) return

    clearSurvivalTimer()

    const iconsUsed = [...selectedIcons]
    iconCountSamplesRef.current.push(iconsUsed.length)

    if (messageStartTimeRef.current !== null) {
      latencySamplesRef.current.push(Date.now() - messageStartTimeRef.current)
    }

    const message = await translateIcons(iconsUsed.map((i) => i.label))

    setSelectedIcons([])
    setNpcLoading(true)
    setNpcResponse(null)

    if (sessionId && authToken) {
      logEvent(authToken, sessionId, 'icon_selection', {
        icons: iconsUsed.map((i) => i.label),
        translated: message,
      })
    }

    try {
      if (mode === 'survival' && history.length > 0) {
        const lastNpc = history.findLast((m) => m.role === 'assistant')?.content ?? ''
        const offContext = await judgeResponse(scenario.id, lastNpc, message)
        if (offContext) {
          await deductHeart('off_context')
          if (hearts - 1 <= 0) {
            setNpcLoading(false)
            return
          }
        }
      }

      // Get and summarize emotions since last response
      const emotionLog = getEmotionLog()
      const emotionSummary = await summarizeEmotionLog(emotionLog)

      const result = await sendDialogue(message, history, {
        scenario_id: scenario.id,
        mode,
        persona,
        mood_modifier: moodModifier ?? undefined,
        emotion: emotionSummary ? {
          summary_emotion: emotionSummary.summary_emotion,
          explanation: emotionSummary.explanation,
          avg_score: emotionSummary.avg_score,
        } : undefined,
      })

      // Reset emotion log for next response cycle
      resetEmotionLog()

      const newHistory: Message[] = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: result.response },
      ]
      setHistory(newHistory)
      setNpcResponse(result.response)
      setNpcEmotion(result.npc_emotion)
      messageStartTimeRef.current = Date.now()

      if (result.audio_base64) playAudio(result.audio_base64)

      if (sessionId && authToken) {
        logEvent(authToken, sessionId, 'npc_response', { content: result.response })
      }

      if (mode === 'survival' && hearts > 0) startSurvivalTimer()
    } catch (err) {
      console.error('Dialogue error:', err)
      setNpcResponse("Sorry, I didn't catch that. Could you try again?")
      if (mode === 'survival') startSurvivalTimer()
    } finally {
      setNpcLoading(false)
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────

  async function handleSignOut() {
    clearSurvivalTimer()
    if (sessionId && authToken && !sessionOver) await endSession(authToken, sessionId, hearts)
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading…</div>
      </div>
    )
  }

  if (sessionOver) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 gap-6 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">{hearts > 0 ? '🎉' : '💔'}</div>
          <h2 className="text-white text-2xl font-bold mb-2">
            {hearts > 0 ? 'Session Complete!' : 'No hearts left!'}
          </h2>
          <p className="text-gray-400 text-sm">
            {hearts > 0
              ? `Great job! You completed the ${scenario.title} scenario.`
              : 'Better luck next time! Keep practising.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/learner/home')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
          >
            Back to Home
          </button>
          <button
            onClick={handleSignOut}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/learner/home')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">Home</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="text-gray-900 font-semibold text-sm">{scenario.title}</h1>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${mode === 'learning' ? 'bg-green-400' : 'bg-rose-400'}`} />
              <p className={`text-xs font-medium ${mode === 'learning' ? 'text-green-500' : 'text-rose-500'}`}>
                {mode === 'learning' ? 'Learning Mode' : 'Survival Mode'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === 'survival' && <HeartsBar hearts={hearts} />}
          <button
            onClick={() => endSessionFlow(hearts)}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors font-medium"
          >
            End Session
          </button>
          <button
            onClick={handleSignOut}
            className="text-gray-500 hover:text-gray-900 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Left: Scenario Stage + Hint Bar */}
        <div className="w-[45%] flex-shrink-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0 relative">
            <ScenarioStage
              npcResponse={npcResponse}
              npcLoading={npcLoading}
              backgroundSrc={scenario.background}
              npcSrc={scenario.npc}
              npcEmotion={npcEmotion}
            />
            {/* Webcam overlay — top-right corner of scenario panel */}
            <div className="absolute top-2 right-2 z-10">
              <WebcamOverlay
                videoRef={videoRef}
                canvasRef={canvasRef}
                currentEmotion={currentEmotion}
                webcamActive={webcamActive}
              />
            </div>
          </div>
          {mode === 'learning' && (
            <SabiHintBar
              scenarioId={scenario.id}
              npcLastMessage={npcResponse}
              visible={!npcLoading && !!npcResponse}
            />
          )}
        </div>

        {/* Right: AAC Board + Message Bar */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <AACBoard
              onIconSelect={handleIconSelect}
              selectedIds={selectedIcons.map((i) => i.id)}
            />
          </div>
          <div className="flex-shrink-0">
            <MessageBar
              selectedIcons={selectedIcons}
              onRemove={handleRemoveIcon}
              onClear={handleClear}
              onSubmit={handleSubmit}
              loading={npcLoading}
            />
          </div>
        </div>
      </div>

      {/* Hidden canvas for JPEG frame capture */}
      <canvas ref={captureFrameRef} className="hidden" aria-hidden="true" />
    </div>
  )
}
