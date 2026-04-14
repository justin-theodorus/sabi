'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
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
import Image from 'next/image'
import livesImg from '@/assets/Lives.png'
import ScenarioStage from '@/components/ScenarioStage'
import AACBoard, { type AACIcon } from '@/components/AACBoard'
import MessageBar from '@/components/MessageBar'
import HeartsBar from '@/components/HeartsBar'
import SabiHintBar from '@/components/SabiHintBar'

const SURVIVAL_TIMEOUT_SEC = 30
const MAX_HEARTS = 5
const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

type Phase = 'lobby' | 'in_session'

interface PastSession {
  id: string
  mode: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  hearts_remaining: number | null
  status: string
}

function getInitialMode(): 'learning' | 'survival' {
  if (typeof window === 'undefined') return 'learning'
  return (sessionStorage.getItem('selectedMode') as 'learning' | 'survival') ?? 'learning'
}

function getInitialScenario() {
  if (typeof window === 'undefined') return SCENARIOS.hawker_centre
  const id = sessionStorage.getItem('selectedScenario')
  return (id && SCENARIOS[id]) ? SCENARIOS[id] : SCENARIOS.hawker_centre
}

function playAudio(base64: string) {
  try {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`)
    audio.play().catch(() => {})
  } catch {}
}

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
    return parts.length > 1 ? parts.join(' ') : null
  } catch { return null }
}

function formatDuration(sec: number | null) {
  if (!sec) return null
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Circular countdown ring */
function CountdownRing({ timeLeft, total }: { timeLeft: number; total: number }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const fraction = timeLeft / total
  const offset = circumference * (1 - fraction)
  const color = fraction > 0.5 ? '#22c55e' : fraction > 0.25 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold" style={{ color }}>
        {timeLeft}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Lobby screen
// ─────────────────────────────────────────────────────────────
function LobbyScreen({
  scenario,
  mode,
  pastSessions,
  historyLoading,
  onStart,
  onBack,
}: {
  scenario: ReturnType<typeof getInitialScenario>
  mode: 'learning' | 'survival'
  pastSessions: PastSession[]
  historyLoading: boolean
  onStart: () => void
  onBack: () => void
}) {
  const isSurvival = mode === 'survival'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-sm font-semibold">Home</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-5 md:px-8 max-w-xl mx-auto w-full pb-8 space-y-5">
        {/* Scenario + mode card */}
        <div className={`rounded-3xl p-6 shadow-sm relative overflow-hidden ${isSurvival ? 'bg-gray-900' : 'bg-white'}`}>
          {/* Decorative blobs */}
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2 ${isSurvival ? 'bg-rose-900/30' : 'bg-[#FDE8DC]'}`} />
          <div className={`absolute bottom-0 left-8 w-20 h-20 rounded-full translate-y-1/2 ${isSurvival ? 'bg-rose-900/20' : 'bg-[#FFF8E7]'}`} />

          <div className="relative">
            <div className="text-5xl mb-3">
              {scenario.id === 'hawker_centre' ? '🍜' : scenario.id === 'group_project' ? '📚' : '🛍️'}
            </div>
            <h1 className={`text-2xl font-extrabold mb-1 ${isSurvival ? 'text-white' : 'text-gray-900'}`}>
              {scenario.title}
            </h1>
            <p className={`text-sm mb-4 ${isSurvival ? 'text-gray-400' : 'text-gray-500'}`}>
              {scenario.description}
            </p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
              isSurvival
                ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              <span>{isSurvival ? '⚔️' : '📚'}</span>
              {isSurvival ? 'Survival Mode — 5 lives · 30s timer · No hints' : 'Learning Mode — Hints available · No pressure'}
            </div>
          </div>
        </div>

        {/* NPC preview */}
        <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0">
            <img src={scenario.npc} alt={scenario.npcName} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-500 text-xs font-semibold">You'll be talking to</p>
            <p className="text-gray-900 font-bold">{scenario.npcName}</p>
            <p className="text-gray-400 text-xs mt-0.5 line-clamp-2 italic">"{scenario.npcGreeting}"</p>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={onStart}
          className={`w-full py-4 rounded-3xl font-extrabold text-lg shadow-md transition-all active:scale-95 ${
            isSurvival
              ? 'bg-rose-500 hover:bg-rose-400 text-white'
              : 'bg-[#E8714A] hover:bg-[#d4613c] text-white'
          }`}
        >
          {isSurvival ? '⚔️ Start Survival' : '📚 Start Practice'}
        </button>

        {/* Past sessions */}
        <div>
          <h2 className="text-gray-900 font-extrabold text-lg mb-3">Your History</h2>

          {historyLoading && (
            <div className="bg-white rounded-3xl p-6 shadow-sm text-center text-gray-400 text-sm">
              Loading history…
            </div>
          )}

          {!historyLoading && pastSessions.length === 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm text-center">
              <p className="text-3xl mb-2">🌱</p>
              <p className="text-gray-500 font-semibold text-sm">No sessions yet for this scenario.</p>
              <p className="text-gray-300 text-xs mt-1">Start your first session above!</p>
            </div>
          )}

          {!historyLoading && pastSessions.length > 0 && (
            <div className="space-y-3">
              {pastSessions.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                  {/* Mode icon */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                    s.mode === 'survival' ? 'bg-rose-50' : 'bg-green-50'
                  }`}>
                    {s.mode === 'survival' ? '⚔️' : '📚'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        s.mode === 'survival' ? 'bg-rose-100 text-rose-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {s.mode === 'survival' ? 'Survival' : 'Learning'}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-gray-400 text-xs">{formatDate(s.started_at)}</span>
                      {s.duration_seconds !== null && (
                        <span className="text-gray-400 text-xs">⏱ {formatDuration(s.duration_seconds)}</span>
                      )}
                      {s.mode === 'survival' && s.hearts_remaining !== null && (
                        <span className="flex gap-0.5 items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Image key={i} src={livesImg} alt="" width={14} height={14}
                              className={`object-contain ${i < s.hearts_remaining! ? '' : 'opacity-20 grayscale'}`} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  {s.status === 'completed' && (
                    <Link
                      href={`/therapist/sessions/${s.id}`}
                      className="text-xs font-bold text-[#E8714A] hover:underline flex-shrink-0"
                    >
                      Report →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main practice component
// ─────────────────────────────────────────────────────────────
export default function PracticePage() {
  const router = useRouter()

  // Auth
  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [persona, setPersona] = useState<string>('guided_learner')

  // Phase
  const [phase, setPhase] = useState<Phase>('lobby')

  // Lobby history
  const [pastSessions, setPastSessions] = useState<PastSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Session config
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mode] = useState<'learning' | 'survival'>(getInitialMode)
  const [scenario] = useState(getInitialScenario)
  const [moodModifier] = useState<string | null>(() => buildMoodModifier())

  // Gameplay
  const [selectedIcons, setSelectedIcons] = useState<AACIcon[]>([])
  const [npcResponse, setNpcResponse] = useState<string | null>(null)
  const [npcEmotion, setNpcEmotion] = useState<string | undefined>(undefined)
  const [npcLoading, setNpcLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [sessionOver, setSessionOver] = useState(false)

  // Countdown
  const [timeLeft, setTimeLeft] = useState(SURVIVAL_TIMEOUT_SEC)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Webcam
  const [webcamActive, setWebcamActive] = useState(false)
  const sessionStartTimeRef = useRef<number>(0)
  const messageStartTimeRef = useRef<number | null>(null)
  const latencySamplesRef = useRef<number[]>([])
  const iconCountSamplesRef = useRef<number[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { videoRef, canvasRef, captureFrameRef, startWebcam, stopWebcam, captureFrame, startRecording, stopRecording } = useWebcam()
  const { getEmotionLog, resetEmotionLog } = useEmotionCapture({
    sessionId, token: authToken,
    sessionStartTime: sessionStartTimeRef.current,
    captureFrame,
    enabled: !sessionOver && webcamActive,
  })

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setAuthToken(session.access_token)
      setUserId(session.user.id)
      const { data } = await supabase.from('learner_profiles').select('persona').eq('user_id', session.user.id).single()
      if (data?.persona) setPersona(data.persona)
      setAuthChecked(true)
    })
  }, [router])

  // ── Fetch history once auth is ready ──────────────────────
  useEffect(() => {
    if (!authChecked || !authToken) return
    setHistoryLoading(true)
    fetch(`${SESSION_URL}/sessions`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data: PastSession[]) => {
        const filtered = (Array.isArray(data) ? data : [])
          .filter((s) => s.status === 'completed' || s.status === 'in_progress')
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
          .slice(0, 10)
        setPastSessions(filtered)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [authChecked, authToken])

  // ── Session init (only when phase transitions to in_session) ─
  useEffect(() => {
    if (!authChecked || !authToken || phase !== 'in_session') return

    async function init() {
      setNpcResponse(scenario.npcGreeting)
      try {
        const id = await startSession(authToken!, scenario.id, mode, persona)
        setSessionId(id)
      } catch {}

      sessionStartTimeRef.current = Date.now()
      messageStartTimeRef.current = Date.now()
      const camOk = await startWebcam()
      if (camOk) { startRecording(); setWebcamActive(true) }
      if (mode === 'survival') startSurvivalTimer()
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Survival timer ────────────────────────────────────────
  const deductHeart = useCallback(async (reason: 'timeout' | 'off_context') => {
    setHearts((prev) => {
      const next = prev - 1
      if (next <= 0) endSessionFlow(0)
      return next
    })
    if (sessionId && authToken) await logEvent(authToken, sessionId, 'heart_lost', { reason })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authToken])

  function startSurvivalTimer() {
    clearSurvivalTimer()
    setTimeLeft(SURVIVAL_TIMEOUT_SEC)
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
    timeoutRef.current = setTimeout(() => deductHeart('timeout'), SURVIVAL_TIMEOUT_SEC * 1000)
  }

  function clearSurvivalTimer() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  useEffect(() => () => clearSurvivalTimer(), [])

  // ── Session end ───────────────────────────────────────────
  async function endSessionFlow(finalHearts: number) {
    clearSurvivalTimer()
    setSessionOver(true)
    stopWebcam(); setWebcamActive(false)

    if (sessionId && authToken) {
      stopRecording().then(async (blob) => {
        if (blob) await uploadSessionVideo(authToken!, sessionId!, blob)
      }).catch(() => {})
      await endSession(authToken, sessionId, finalHearts)
    }

    if (userId && latencySamplesRef.current.length > 0) {
      const avg_latency = latencySamplesRef.current.reduce((a, b) => a + b, 0) / latencySamplesRef.current.length
      const avg_icons = iconCountSamplesRef.current.length > 0
        ? iconCountSamplesRef.current.reduce((a, b) => a + b, 0) / iconCountSamplesRef.current.length : 2
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_PERSONA_URL || 'http://localhost:8002') + '/classify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avg_response_latency_ms: avg_latency, re_prompt_count: 0, avg_icons_per_message: avg_icons }),
        })
        if (res.ok) {
          const { persona: newPersona } = await res.json()
          setPersona(newPersona)
          await fetch((process.env.NEXT_PUBLIC_PERSONA_URL || 'http://localhost:8002') + `/profile/${userId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ persona: newPersona, avg_response_latency_ms: avg_latency }),
          })
        }
      } catch {}
    }
  }

  // ── Start session from lobby ──────────────────────────────
  function handleStartSession() {
    setSessionOver(false)
    setHearts(MAX_HEARTS)
    setHistory([])
    setSelectedIcons([])
    setNpcResponse(null)
    setSessionId(null)
    setPhase('in_session')
  }

  // ── Go back to lobby ──────────────────────────────────────
  function handleBackToLobby() {
    clearSurvivalTimer()
    if (sessionId && authToken && !sessionOver) {
      endSession(authToken, sessionId, hearts).catch(() => {})
    }
    stopWebcam(); setWebcamActive(false)
    setSessionOver(false)
    setHearts(MAX_HEARTS)
    setHistory([])
    setSelectedIcons([])
    setNpcResponse(null)
    setSessionId(null)
    // Refresh history
    if (authToken) {
      setHistoryLoading(true)
      fetch(`${SESSION_URL}/sessions`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json())
        .then((data: PastSession[]) => {
          const filtered = (Array.isArray(data) ? data : [])
            .filter((s) => s.status === 'completed' || s.status === 'in_progress')
            .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
            .slice(0, 10)
          setPastSessions(filtered)
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false))
    }
    setPhase('lobby')
  }

  // ── Icon handlers ─────────────────────────────────────────
  function handleIconSelect(icon: AACIcon) { setSelectedIcons((p) => [...p, icon]) }
  function handleRemoveIcon(index: number) { setSelectedIcons((p) => p.filter((_, i) => i !== index)) }
  function handleClear() { setSelectedIcons([]) }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (selectedIcons.length === 0 || npcLoading || sessionOver) return
    clearSurvivalTimer()

    const iconsUsed = [...selectedIcons]
    iconCountSamplesRef.current.push(iconsUsed.length)
    if (messageStartTimeRef.current !== null) latencySamplesRef.current.push(Date.now() - messageStartTimeRef.current)

    const message = await translateIcons(iconsUsed.map((i) => i.label))
    setSelectedIcons([]); setNpcLoading(true); setNpcResponse(null)

    if (sessionId && authToken) logEvent(authToken, sessionId, 'icon_selection', { icons: iconsUsed.map((i) => i.label), translated: message })

    try {
      if (mode === 'survival' && history.length > 0) {
        const lastNpc = history.findLast((m) => m.role === 'assistant')?.content ?? ''
        if (await judgeResponse(scenario.id, lastNpc, message)) {
          await deductHeart('off_context')
          if (hearts - 1 <= 0) { setNpcLoading(false); return }
        }
      }

      const emotionLog = getEmotionLog()
      const emotionSummary = await summarizeEmotionLog(emotionLog)
      const result = await sendDialogue(message, history, {
        scenario_id: scenario.id, mode, persona,
        mood_modifier: moodModifier ?? undefined,
        emotion: emotionSummary ? { summary_emotion: emotionSummary.summary_emotion, explanation: emotionSummary.explanation, avg_score: emotionSummary.avg_score } : undefined,
      })
      resetEmotionLog()

      const newHistory: Message[] = [...history, { role: 'user', content: message }, { role: 'assistant', content: result.response }]
      setHistory(newHistory); setNpcResponse(result.response); setNpcEmotion(result.npc_emotion)
      messageStartTimeRef.current = Date.now()
      if (result.audio_base64) playAudio(result.audio_base64)
      if (sessionId && authToken) logEvent(authToken, sessionId, 'npc_response', { content: result.response })
      if (mode === 'survival' && hearts > 0) startSurvivalTimer()
    } catch (err) {
      console.error('Dialogue error:', err)
      setNpcResponse("Sorry, I didn't catch that. Could you try again?")
      if (mode === 'survival') startSurvivalTimer()
    } finally {
      setNpcLoading(false)
    }
  }

  async function handleSignOut() {
    clearSurvivalTimer()
    if (sessionId && authToken && !sessionOver) await endSession(authToken, sessionId, hearts)
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Render ────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5EFE8]">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  // ── Lobby ─────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <LobbyScreen
        scenario={scenario}
        mode={mode}
        pastSessions={pastSessions}
        historyLoading={historyLoading}
        onStart={handleStartSession}
        onBack={() => router.push('/learner/practice')}
      />
    )
  }

  const isSurvival = mode === 'survival'
  const bgClass = isSurvival ? 'bg-gray-950' : 'bg-gray-100'
  const headerClass = isSurvival ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'

  // ── Session over ──────────────────────────────────────────
  if (sessionOver) {
    const won = hearts > 0
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isSurvival ? 'bg-gray-950' : 'bg-[#F5EFE8]'} gap-6 px-6`}>
        {isSurvival ? (
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center text-6xl"
              style={{ background: won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
              {won ? '🏆' : '💔'}
            </div>
            <h2 className={`text-3xl font-extrabold mb-2 ${won ? 'text-green-400' : 'text-rose-400'}`}>
              {won ? 'You Survived!' : 'Game Over'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {won
                ? `You completed ${scenario.title} with ${hearts} life${hearts !== 1 ? 's' : ''} remaining.`
                : `You ran out of lives. Keep practising!`}
            </p>
            <div className="flex items-center justify-center gap-2 mb-8 p-4 bg-gray-900 rounded-2xl">
              <span className="text-gray-400 text-sm font-semibold">Lives left:</span>
              <div className="flex gap-1">
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <div key={i} className={i < hearts ? 'opacity-100' : 'opacity-20 grayscale'}>
                    <Image src={livesImg} alt="life" width={28} height={28} className="object-contain" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleBackToLobby} className="px-6 py-3 bg-[#E8714A] hover:bg-[#d4613c] text-white rounded-2xl font-bold transition-colors">
                Back to Lobby
              </button>
              <button onClick={handleStartSession} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold transition-colors">
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-gray-900 text-2xl font-bold mb-2">Session Complete!</h2>
            <p className="text-gray-500 text-sm mb-6">Great job! You completed the {scenario.title} scenario.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleBackToLobby} className="px-6 py-3 bg-[#E8714A] hover:bg-[#d4613c] text-white rounded-2xl font-bold transition-colors">
                Back to Lobby
              </button>
              <button onClick={handleSignOut} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Active session ────────────────────────────────────────
  return (
    <div className={`h-screen w-screen ${bgClass} flex flex-col overflow-hidden`}>
      <header className={`flex items-center justify-between px-4 py-2 border-b ${headerClass} flex-shrink-0`}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToLobby}
            className={`flex items-center gap-1.5 transition-colors ${isSurvival ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">Lobby</span>
          </button>
          <div className={`w-px h-5 ${isSurvival ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <div>
            <h1 className={`font-semibold text-sm ${isSurvival ? 'text-white' : 'text-gray-900'}`}>{scenario.title}</h1>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isSurvival ? 'bg-rose-500 animate-pulse' : 'bg-green-400'}`} />
              <p className={`text-xs font-medium ${isSurvival ? 'text-rose-400' : 'text-green-500'}`}>
                {isSurvival ? 'Survival Mode' : 'Learning Mode'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSurvival && <><CountdownRing timeLeft={timeLeft} total={SURVIVAL_TIMEOUT_SEC} /><HeartsBar hearts={hearts} /></>}
          <button onClick={() => endSessionFlow(hearts)} className={`px-3 py-1 text-sm rounded-lg transition-colors font-medium ${isSurvival ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            End Session
          </button>
          <button onClick={handleSignOut} className={`text-sm transition-colors ${isSurvival ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-900'}`}>
            Sign out
          </button>
        </div>
      </header>

      {isSurvival && timeLeft <= 10 && !npcLoading && (
        <div className="flex-shrink-0 bg-rose-900/60 border-b border-rose-700/50 px-4 py-1.5 flex items-center justify-center">
          <span className="text-rose-300 text-xs font-bold animate-pulse">⚠️ Hurry! Only {timeLeft}s left!</span>
        </div>
      )}

      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        <div className="w-[45%] flex-shrink-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0 relative">
            <ScenarioStage npcResponse={npcResponse} npcLoading={npcLoading} backgroundSrc={scenario.background} npcSrc={scenario.npc} npcEmotion={npcEmotion} />
            {/* Hidden camera elements — keep running for emotion capture & recording */}
            <video ref={videoRef} muted playsInline className="hidden" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Recording indicator */}
            {webcamActive && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording
              </div>
            )}
            {isSurvival && (
              <div className="absolute bottom-3 left-3 z-10 flex gap-1">
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <div key={i} className={`transition-all duration-300 drop-shadow-md ${i < hearts ? 'opacity-100' : 'opacity-20 grayscale'}`}>
                    <Image src={livesImg} alt="life" width={28} height={28} className="object-contain" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {mode === 'learning' && (
            <SabiHintBar scenarioId={scenario.id} npcLastMessage={npcResponse} visible={!npcLoading && !!npcResponse} />
          )}
        </div>
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <AACBoard onIconSelect={handleIconSelect} selectedIds={selectedIcons.map((i) => i.id)} scenarioIcons={scenario.scenarioIcons} />
          </div>
          <div className="flex-shrink-0">
            <MessageBar selectedIcons={selectedIcons} onRemove={handleRemoveIcon} onClear={handleClear} onSubmit={handleSubmit} loading={npcLoading} />
          </div>
        </div>
      </div>

      <canvas ref={captureFrameRef} className="hidden" aria-hidden="true" />
    </div>
  )
}
