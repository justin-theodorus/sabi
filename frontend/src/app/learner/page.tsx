'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendDialogue, judgeResponse, type Message } from '@/lib/dialogue'
import { translateIcons } from '@/lib/aac-translate'
import { startSession, endSession, logEvent } from '@/lib/session'
import { uploadSessionVideo } from '@/lib/minio-upload'
import { type ScenarioConfig } from '@/lib/scenarios'
import { useWebcam } from '@/hooks/useWebcam'
import { useEmotionCapture } from '@/hooks/useEmotionCapture'
import ScenarioStage from '@/components/ScenarioStage'
import AACBoard, { type AACIcon } from '@/components/AACBoard'
import MessageBar from '@/components/MessageBar'
import ModeSelector from '@/components/ModeSelector'
import HeartsBar from '@/components/HeartsBar'
import SabiHintBar from '@/components/SabiHintBar'

// Dynamic import avoids SSR crash from MediaPipe browser APIs
const WebcamOverlay = dynamic(() => import('@/components/WebcamOverlay'), { ssr: false })

const SURVIVAL_TIMEOUT_MS = 30_000
const MAX_HEARTS = 5

function playAudio(base64: string) {
  try {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`)
    audio.play().catch(() => {})
  } catch {}
}

export default function LearnerPage() {
  const router = useRouter()

  // Auth
  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [persona, setPersona] = useState<string>('guided_learner')

  // Session setup
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [scenario, setScenario] = useState<ScenarioConfig | null>(null)
  const [mode, setMode] = useState<'learning' | 'survival'>('learning')

  // Gameplay state
  const [selectedIcons, setSelectedIcons] = useState<AACIcon[]>([])
  const [npcResponse, setNpcResponse] = useState<string | null>(null)
  const [npcLoading, setNpcLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [sessionOver, setSessionOver] = useState(false)

  // Webcam / recording state
  const [webcamActive, setWebcamActive] = useState(false)
  const sessionStartTimeRef = useRef<number>(0)

  // Metrics for persona classification
  const messageStartTimeRef = useRef<number | null>(null)
  const latencySamplesRef = useRef<number[]>([])
  const turnCountRef = useRef(0)
  const iconCountSamplesRef = useRef<number[]>([])

  // Survival timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Webcam hook (encapsulates getUserMedia + MediaRecorder)
  const { videoRef, canvasRef, captureFrameRef, startWebcam, stopWebcam, captureFrame, startRecording, stopRecording } =
    useWebcam()

  // Emotion capture hook (500ms interval → expression-service → session-service)
  const currentEmotion = useEmotionCapture({
    sessionId,
    token: authToken,
    sessionStartTime: sessionStartTimeRef.current,
    captureFrame,
    enabled: sessionStarted && !sessionOver && webcamActive,
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

      // Load stored persona from Supabase
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

  async function handleStart(selectedScenario: ScenarioConfig, selectedMode: 'learning' | 'survival') {
    setScenario(selectedScenario)
    setMode(selectedMode)
    setHearts(MAX_HEARTS)
    setHistory([])
    setNpcResponse(selectedScenario.npcGreeting)
    messageStartTimeRef.current = Date.now()

    if (authToken) {
      try {
        const id = await startSession(authToken, selectedScenario.id, selectedMode, persona)
        setSessionId(id)
      } catch {
        // Continue without session logging if service unavailable
      }
    }

    // Start webcam + recording
    sessionStartTimeRef.current = Date.now()
    const camOk = await startWebcam()
    if (camOk) {
      startRecording()
      setWebcamActive(true)
    }

    setSessionStarted(true)
    if (selectedMode === 'survival') startSurvivalTimer()
  }

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
  }, [sessionId, authToken]) // eslint-disable-line react-hooks/exhaustive-deps

  function startSurvivalTimer() {
    clearSurvivalTimer()
    timeoutRef.current = setTimeout(() => {
      deductHeart('timeout')
    }, SURVIVAL_TIMEOUT_MS)
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

    // Stop webcam + upload recording (fire-and-forget, must not block UI)
    stopWebcam()
    setWebcamActive(false)
    if (sessionId && authToken) {
      stopRecording().then(async (blob) => {
        if (blob) {
          await uploadSessionVideo(authToken!, sessionId!, blob)
        }
      }).catch(() => {})
    }

    if (sessionId && authToken) {
      await endSession(authToken, sessionId, finalHearts)
    }

    // Classify persona after session using collected metrics
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
          // Persist to Supabase via persona engine
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

    // Measure response latency
    if (messageStartTimeRef.current !== null) {
      const latency = Date.now() - messageStartTimeRef.current
      latencySamplesRef.current.push(latency)
    }

    // Translate icons to natural language
    const message = await translateIcons(iconsUsed.map((i) => i.label))

    setSelectedIcons([])
    setNpcLoading(true)
    setNpcResponse(null)

    // Log learner message
    if (sessionId && authToken) {
      logEvent(authToken, sessionId, 'icon_selection', {
        icons: iconsUsed.map((i) => i.label),
        translated: message,
      })
    }

    try {
      // Survival Mode: judge if off-context before sending to NPC
      if (mode === 'survival' && history.length > 0) {
        const lastNpc = history.findLast((m) => m.role === 'assistant')?.content ?? ''
        const offContext = await judgeResponse(scenario?.id ?? 'hawker_centre', lastNpc, message)
        if (offContext) {
          await deductHeart('off_context')
          if (hearts - 1 <= 0) {
            setNpcLoading(false)
            return
          }
        }
      }

      const result = await sendDialogue(message, history, {
        scenario_id: scenario?.id,
        mode,
        persona,
      })

      const newHistory: Message[] = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: result.response },
      ]
      setHistory(newHistory)
      setNpcResponse(result.response)
      turnCountRef.current += 1
      messageStartTimeRef.current = Date.now()

      if (result.audio_base64) playAudio(result.audio_base64)

      // Log NPC response
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

  function handlePlayAgain() {
    setSessionStarted(false)
    setSessionOver(false)
    setSessionId(null)
    setScenario(null)
    setHistory([])
    setNpcResponse(null)
    setHearts(MAX_HEARTS)
    setWebcamActive(false)
    latencySamplesRef.current = []
    iconCountSamplesRef.current = []
    turnCountRef.current = 0
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading…</div>
      </div>
    )
  }

  if (!sessionStarted) {
    return <ModeSelector onStart={handleStart} />
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
              ? `Great job! You completed the ${scenario?.title} scenario.`
              : 'Better luck next time! Keep practising.'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePlayAgain}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
          >
            Play Again
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
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">{scenario?.title}</h1>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${mode === 'learning' ? 'bg-green-400' : 'bg-rose-400'}`}
              />
              <p className={`text-xs font-medium ${mode === 'learning' ? 'text-green-400' : 'text-rose-400'}`}>
                {mode === 'learning' ? 'Learning Mode' : 'Survival Mode'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === 'survival' && <HeartsBar hearts={hearts} />}
          <button
            onClick={() => endSessionFlow(hearts)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg transition-colors"
          >
            End Session
          </button>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-white text-sm transition-colors"
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
              backgroundSrc={scenario?.background}
              npcSrc={scenario?.npc}
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
              scenarioId={scenario?.id ?? 'hawker_centre'}
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
              scenarioIcons={scenario?.scenarioIcons}
              scenarioLabel={scenario?.title}
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

      {/* Hidden canvas for JPEG frame capture — not rendered visually */}
      <canvas ref={captureFrameRef} className="hidden" aria-hidden="true" />
    </div>
  )
}
