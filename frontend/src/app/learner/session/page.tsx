'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { streamDialogue, judgeResponse, type Message } from '@/lib/dialogue'
import type { ScenarioConfig, ScenarioEvent } from '@/lib/scenarios'
import { ICONS } from '@/components/AACBoard'
import { summarizeEmotionLog } from '@/lib/emotion-summary'
import { translateIcons } from '@/lib/aac-translate'
import { startSession, endSession, logEvent, keepAlive } from '@/lib/session'
import { uploadSessionVideo } from '@/lib/minio-upload'
import { SCENARIOS } from '@/lib/scenarios'
import { useWebcam } from '@/hooks/useWebcam'
import { useEmotionCapture } from '@/hooks/useEmotionCapture'
import ScenarioStage from '@/components/ScenarioStage'
import SpeechBubble from '@/components/SpeechBubble'
import AACBoard, { type AACIcon } from '@/components/AACBoard'
import SabiHintBar from '@/components/SabiHintBar'

const SURVIVAL_TIMEOUT_SEC = 30
const BUMP_SEC_SURVIVAL = 15   // NPC speaks first after 15s in survival
const BUMP_SEC_LEARNING = 20   // NPC speaks first after 20s in learning
const MAX_HEARTS = 5
const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

type Phase = 'lobby' | 'in_session'

function getInitialMode(): 'learning' | 'survival' {
  if (typeof window === 'undefined') return 'learning'
  return (sessionStorage.getItem('selectedMode') as 'learning' | 'survival') ?? 'learning'
}

function getInitialScenario(): ScenarioConfig {
  if (typeof window === 'undefined') return SCENARIOS.hawker_centre
  try {
    const raw = sessionStorage.getItem('selectedScenarioConfig')
    if (raw) {
      const parsed = JSON.parse(raw) as ScenarioConfig
      if (parsed?.id) {
        // Sanitize stale or bad npc/background values — if they don't look like
        // real paths (e.g. leftover "1 Twist" from the unpredictableEvents bug),
        // fall back to the base scenario's assets.
        if (parsed.baseScenario) {
          const base = SCENARIOS[parsed.baseScenario] ?? SCENARIOS.hawker_centre
          if (!parsed.npc?.startsWith('/')) parsed.npc = base.npc
          if (!parsed.background?.startsWith('/')) parsed.background = base.background
        }
        return parsed
      }
    }
  } catch {}
  const id = sessionStorage.getItem('selectedScenario')
  return (id && SCENARIOS[id]) ? SCENARIOS[id] : SCENARIOS.hawker_centre
}

function playAudio(base64: string) {
  try {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`)
    audio.play().catch(() => {})
  } catch {}
}

// ── Audio queue for streaming TTS chunks ──────────────────────────────────
// Plays audio chunks in order as they arrive from the SSE stream.
const audioQueueRef = { current: [] as string[] }
const audioPlayingRef = { current: false }

function drainAudioQueue() {
  const next = audioQueueRef.current.shift()
  if (!next) { audioPlayingRef.current = false; return }
  audioPlayingRef.current = true
  try {
    const audio = new Audio(`data:audio/mp3;base64,${next}`)
    audio.onended = drainAudioQueue
    audio.play().catch(() => { audioPlayingRef.current = false; drainAudioQueue() })
  } catch { audioPlayingRef.current = false; drainAudioQueue() }
}

function enqueueAudio(base64: string) {
  audioQueueRef.current.push(base64)
  if (!audioPlayingRef.current) drainAudioQueue()
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

/** Circular countdown ring */
function CountdownRing({ timeLeft, total }: { timeLeft: number; total: number }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const fraction = timeLeft / total
  const offset = circumference * (1 - fraction)
  const color = fraction > 0.5 ? '#22c55e' : fraction > 0.25 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
      <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="4" />
        <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color }}>
        {timeLeft}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Lobby screen (Fix 3/8: no blobs, no history, clean design)
// ─────────────────────────────────────────────────────────────
function LobbyScreen({
  scenario,
  mode,
  onStart,
  onBack,
}: {
  scenario: ReturnType<typeof getInitialScenario>
  mode: 'learning' | 'survival'
  onStart: () => void
  onBack: () => void
}) {
  const isSurvival = mode === 'survival'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>
      {/* Back button — 32px circle */}
      <div style={{ padding: '16px 24px 0' }}>
        <button onClick={onBack}
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-sub)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '480px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Scene title + description */}
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: '8px' }}>
            {scenario.title}
          </h1>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {scenario.description}
          </p>
        </div>

        {/* Mode badge */}
        <div>
          <span className={isSurvival ? 'badge-survival' : 'badge-learning'}>
            {isSurvival ? 'Survival Mode — 5 hearts · 30s timer · No hints' : 'Learning Mode — Hints available · No pressure'}
          </span>
        </div>

        {/* NPC preview card */}
        <div style={{ background: 'var(--surface-sub)', borderRadius: '16px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
            <img src={scenario.npc} alt={scenario.npcName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '2px' }}>You will be talking to</p>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{scenario.npcName}</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
              &ldquo;{scenario.npcGreeting}&rdquo;
            </p>
          </div>
        </div>

        {/* Start button */}
        <button onClick={onStart}
          style={{ width: '100%', height: '56px', borderRadius: '16px', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', background: isSurvival ? 'var(--pink)' : 'var(--green)', color: '#fff', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          {isSurvival ? (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L11 7h5.5l-4.5 3.5 1.7 5-4.2-3-4.2 3 1.7-5L1.5 7H7L9 1.5z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" fill="rgba(255,255,255,.3)" />
              </svg>
              Start Survival
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="3" width="12" height="12" rx="1.5" stroke="#fff" strokeWidth="1.4" />
                <path d="M5.5 6.5h7M5.5 9h7M5.5 11.5h4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Start Practice
            </>
          )}
        </button>
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

  // Board overlay (Fix 5)
  const [boardOpen, setBoardOpen] = useState(false)

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
  const [turnIndex, setTurnIndex] = useState(0)

  // Unexpected events
  const [rolledEvent, setRolledEvent] = useState<ScenarioEvent | null>(null)
  const eventTriggerTurnRef = useRef<number>(0)
  const [activeEventText, setActiveEventText] = useState<string | null>(null)
  // Refs for values needed inside timer callbacks (avoid stale closures)
  const historyRef = useRef<Message[]>([])
  const turnIndexRef = useRef<number>(0)
  const heartsRef = useRef<number>(MAX_HEARTS)
  const npcLoadingRef = useRef<boolean>(false)
  const sessionOverRef = useRef<boolean>(false)
  const rolledEventRef = useRef<ScenarioEvent | null>(null)

  // Countdown
  const [timeLeft, setTimeLeft] = useState(SURVIVAL_TIMEOUT_SEC)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bumpRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Webcam
  const [webcamActive, setWebcamActive] = useState(false)
  const sessionStartTimeRef = useRef<number>(0)
  const messageStartTimeRef = useRef<number | null>(null)
  const latencySamplesRef = useRef<number[]>([])
  const iconCountSamplesRef = useRef<number[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasNpcInitiatedRef = useRef<boolean>(false)

  // Keep refs in sync with state for timer callbacks
  historyRef.current = history
  turnIndexRef.current = turnIndex
  heartsRef.current = hearts
  npcLoadingRef.current = npcLoading
  sessionOverRef.current = sessionOver
  rolledEventRef.current = rolledEvent

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

  // ── Session heartbeat — keeps Redis alive key refreshed every 10s ──────
  useEffect(() => {
    if (phase !== 'in_session' || !sessionId || !authToken) return
    const id = setInterval(() => keepAlive(authToken, sessionId), 10_000)
    return () => clearInterval(id)
  }, [phase, sessionId, authToken])


  // ── Session init (only when phase transitions to in_session) ─
  useEffect(() => {
    if (!authChecked || !authToken || phase !== 'in_session') return

    async function init() {
      setNpcResponse(scenario.npcGreeting)
      setTurnIndex(0)
      setActiveEventText(null)

      // Roll a random unexpected event (if scenario has any)
      const events = scenario.events ?? []
      if (events.length > 0) {
        const picked = events[Math.floor(Math.random() * events.length)]
        setRolledEvent(picked)
        // Trigger between turn 2 and 4
        eventTriggerTurnRef.current = Math.floor(Math.random() * 3) + 2
      } else {
        setRolledEvent(null)
        eventTriggerTurnRef.current = 0
      }

      try {
        const id = await startSession(authToken!, scenario.id, mode, persona)
        setSessionId(id)
      } catch {}

      sessionStartTimeRef.current = Date.now()
      messageStartTimeRef.current = Date.now()
      const camOk = await startWebcam()
      if (camOk) { startRecording(); setWebcamActive(true) }
      startIdleTimer()
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Timers ────────────────────────────────────────────────
  const deductHeart = useCallback(async (reason: 'timeout' | 'off_context') => {
    setHearts((prev) => {
      const next = prev - 1
      if (next <= 0) endSessionFlow(0)
      return next
    })
    if (sessionId && authToken) await logEvent(authToken, sessionId, 'heart_lost', { reason })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, authToken])

  // triggerNpcBump is defined after handleSubmit — store a ref so startIdleTimer can call it
  const triggerNpcBumpRef = useRef<(() => void) | null>(null)

  function startIdleTimer() {
    clearIdleTimer()
    const bumpSec = mode === 'survival' ? BUMP_SEC_SURVIVAL : BUMP_SEC_LEARNING

    if (mode === 'survival') {
      setTimeLeft(SURVIVAL_TIMEOUT_SEC)
      countdownRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
      // Stage 2: deduct heart at full timeout
      timeoutRef.current = setTimeout(() => deductHeart('timeout'), SURVIVAL_TIMEOUT_SEC * 1000)
    }

    // Stage 1: NPC bump (both modes)
    bumpRef.current = setTimeout(() => {
      triggerNpcBumpRef.current?.()
    }, bumpSec * 1000)
  }

  function clearIdleTimer() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    if (bumpRef.current) { clearTimeout(bumpRef.current); bumpRef.current = null }
  }

  useEffect(() => () => clearIdleTimer(), [])

  // ── Session end ───────────────────────────────────────────
  async function endSessionFlow(finalHearts: number) {
    clearIdleTimer()
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
    setBoardOpen(false)
    setPhase('in_session')
  }

  // ── Go back to lobby ──────────────────────────────────────
  function handleBackToLobby() {
    clearIdleTimer()
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
    setBoardOpen(false)
    setPhase('lobby')
  }

  // ── Icon handlers ─────────────────────────────────────────
  function handleIconSelect(icon: AACIcon) { setSelectedIcons((p) => [...p, icon]) }
  function handleRemoveIcon(index: number) { setSelectedIcons((p) => p.filter((_, i) => i !== index)) }
  function handleClear() { setSelectedIcons([]) }

  // ── Available icon labels (scenario-specific + core words) ──
  // Memoized so the array reference is stable across renders — prevents the
  // SabiHintBar useEffect from resetting its 4-second timer on every render.
  const availableIconLabels = useMemo(() => [
    ...ICONS.filter((i) => i.category === 'core_words').map((i) => i.label),
    ...scenario.scenarioIcons.map((i) => i.label),
  ], [scenario.scenarioIcons])

  // ── NPC bump (called after idle timeout, Stage 1) ─────────
  async function triggerNpcBump() {
    // Use refs to avoid stale closure (called from setTimeout)
    if (npcLoadingRef.current || sessionOverRef.current) return
    setNpcLoading(true)
    npcLoadingRef.current = true
    try {
      const currentTurn = turnIndexRef.current
      const currentHistory = historyRef.current
      const currentRolledEvent = rolledEventRef.current
      const currentHearts = heartsRef.current

      const isEventTurn = currentRolledEvent && eventTriggerTurnRef.current > 0 && currentTurn >= eventTriggerTurnRef.current
      const eventContext = isEventTurn ? currentRolledEvent!.context : undefined

      if (isEventTurn) setActiveEventText(currentRolledEvent!.npcLine)

      let bumpText = ''
      let bumpComplete = false
      await streamDialogue('', currentHistory, {
        scenario_id: scenario.baseScenario ?? scenario.id, mode, persona,
        mood_modifier: moodModifier ?? undefined,
        available_icons: availableIconLabels,
        turn_index: currentTurn,
        npc_initiated: true,
        npc_personality: scenario.npcPersonality,
        support_level: scenario.supportLevel,
        active_event: eventContext,
      }, {
        onText: (chunk) => { bumpText += chunk; setNpcResponse(bumpText) },
        onAudio: (_, b64) => enqueueAudio(b64),
        onDone: (emotion, complete, fullText) => {
          setNpcEmotion(emotion); setNpcResponse(fullText); bumpComplete = complete
        },
      })

      const newHistory: Message[] = [...currentHistory, { role: 'assistant', content: bumpText }]
      setHistory(newHistory)
      if (sessionId && authToken) logEvent(authToken, sessionId, 'npc_response', { content: bumpText, npc_initiated: true })
      wasNpcInitiatedRef.current = true
      if (bumpComplete) { endSessionFlow(currentHearts); return }
    } catch {}
    finally { setNpcLoading(false); npcLoadingRef.current = false }
    // Restart idle timer after bump
    startIdleTimer()
  }

  // Wire bump ref so the timer callback can reach it
  triggerNpcBumpRef.current = triggerNpcBump

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (selectedIcons.length === 0 || npcLoading || sessionOver) return
    clearIdleTimer()
    setBoardOpen(false)

    const currentTurn = turnIndex
    const iconsUsed = [...selectedIcons]
    iconCountSamplesRef.current.push(iconsUsed.length)
    if (messageStartTimeRef.current !== null) latencySamplesRef.current.push(Date.now() - messageStartTimeRef.current)

    const responseLatencyMs = messageStartTimeRef.current !== null ? Date.now() - messageStartTimeRef.current : null
    const message = await translateIcons(iconsUsed.map((i) => i.label))
    setSelectedIcons([]); setNpcLoading(true); setNpcResponse(null)

    const afterNpcPrompt = wasNpcInitiatedRef.current
    wasNpcInitiatedRef.current = false
    if (sessionId && authToken) logEvent(authToken, sessionId, 'icon_selection', {
      icons: iconsUsed.map((i) => i.label),
      translated: message,
      response_latency_ms: responseLatencyMs,
      turn_index: currentTurn,
      is_repair: npcEmotion === 'confused',
      after_npc_prompt: afterNpcPrompt,
    })

    // Determine if this turn triggers the rolled event
    const isEventTurn = rolledEvent && eventTriggerTurnRef.current > 0 && currentTurn >= eventTriggerTurnRef.current && currentTurn < eventTriggerTurnRef.current + 2
    const eventContext = isEventTurn ? rolledEvent!.context : undefined
    if (isEventTurn && currentTurn === eventTriggerTurnRef.current) setActiveEventText(rolledEvent!.npcLine)
    if (currentTurn >= (eventTriggerTurnRef.current + 2)) setActiveEventText(null)

    try {
      if (mode === 'survival' && history.length > 0) {
        const lastNpc = history.findLast((m) => m.role === 'assistant')?.content ?? ''
        if (await judgeResponse(scenario.baseScenario ?? scenario.id, lastNpc, message)) {
          await deductHeart('off_context')
          if (hearts - 1 <= 0) { setNpcLoading(false); return }
        }
      }

      const emotionLog = getEmotionLog()
      const emotionSummary = await summarizeEmotionLog(emotionLog)
      let replyText = ''
      let replyComplete = false
      await streamDialogue(message, history, {
        scenario_id: scenario.baseScenario ?? scenario.id, mode, persona,
        mood_modifier: moodModifier ?? undefined,
        emotion: emotionSummary ? { summary_emotion: emotionSummary.summary_emotion, explanation: emotionSummary.explanation, avg_score: emotionSummary.avg_score } : undefined,
        available_icons: availableIconLabels,
        turn_index: currentTurn,
        npc_personality: scenario.npcPersonality,
        support_level: scenario.supportLevel,
        npc_initiated: false,
        active_event: eventContext,
      }, {
        onText: (chunk) => { replyText += chunk; setNpcResponse(replyText) },
        onAudio: (_, b64) => enqueueAudio(b64),
        onDone: (emotion, complete, fullText) => {
          setNpcEmotion(emotion); setNpcResponse(fullText); replyComplete = complete
        },
      })
      resetEmotionLog()

      setTurnIndex((t) => t + 1)
      const newHistory: Message[] = [...history, { role: 'user', content: message }, { role: 'assistant', content: replyText }]
      setHistory(newHistory)
      messageStartTimeRef.current = Date.now()
      if (sessionId && authToken) logEvent(authToken, sessionId, 'npc_response', { content: replyText })
      if (replyComplete) { endSessionFlow(hearts); return }
      startIdleTimer()
    } catch (err) {
      console.error('Dialogue error:', err)
      setNpcResponse("Sorry, I didn't catch that. Could you try again?")
      startIdleTimer()
    } finally {
      setNpcLoading(false)
    }
  }

  async function handleSignOut() {
    clearIdleTimer()
    if (sessionId && authToken && !sessionOver) await endSession(authToken, sessionId, hearts)
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Render ────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  // ── Lobby ─────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <LobbyScreen
        scenario={scenario}
        mode={mode}
        onStart={handleStartSession}
        onBack={() => router.push('/learner/practice')}
      />
    )
  }

  const isSurvival = mode === 'survival'

  // ── Session over ──────────────────────────────────────────
  if (sessionOver) {
    const won = hearts > 0
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '24px', background: isSurvival ? '#0a0a0f' : 'var(--bg)', fontFamily: 'var(--font)' }}>
        {isSurvival ? (
          <div style={{ textAlign: 'center', maxWidth: '360px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 16px', background: won ? 'rgba(47,176,90,.15)' : 'rgba(255,147,161,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {won ? (
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="13" y="28" width="14" height="4" rx="1.5" fill="#2FB05A" opacity=".8" />
                  <rect x="16" y="32" width="8" height="3" rx="1" fill="#2FB05A" opacity=".6" />
                  <path d="M10 8h20v10a10 10 0 01-20 0V8z" fill="#2FB05A" opacity=".8" />
                  <path d="M10 11H6a4 4 0 004 4" stroke="#2FB05A" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M30 11h4a4 4 0 01-4 4" stroke="#2FB05A" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M20 34l-1.8-1.65C10 24.6 6 21.2 6 16.5 6 12.9 8.9 10 12.5 10c2.17 0 4.26 1.01 5.5 2.59L20 14l2-1.41C23.24 11.01 25.33 10 27.5 10 31.1 10 34 12.9 34 16.5c0 4.7-4 8.1-12.2 15.85L20 34z" fill="var(--pink)" opacity=".3" />
                  <path d="M17 14l-2.5 6h5l-2.5 6" stroke="var(--pink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '8px', color: won ? '#2FB05A' : 'var(--pink)' }}>
              {won ? 'You Survived!' : 'Game Over'}
            </h2>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: 1.5 }}>
              {won
                ? `You completed ${scenario.title} with ${hearts} life${hearts !== 1 ? 's' : ''} remaining.`
                : 'You ran out of lives. Keep practising!'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '32px', padding: '16px', background: 'rgba(255,255,255,.06)', borderRadius: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#888' }}>Lives left:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <svg key={i} width="24" height="24" viewBox="0 0 24 24" fill={i < hearts ? 'var(--pink)' : 'rgba(255,255,255,.15)'}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={handleBackToLobby} style={{ padding: '12px 24px', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Back</button>
              <button onClick={handleStartSession} style={{ padding: '12px 24px', background: 'var(--pink)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Try Again</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', maxWidth: '360px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(47,176,90,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="#2FB05A" strokeWidth="2.5" />
                <path d="M13 20l5 5 9-9" stroke="#2FB05A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '8px' }}>Session Complete!</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Great job! You completed the {scenario.title} scenario.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={handleBackToLobby} style={{ padding: '12px 24px', background: 'var(--green)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Back</button>
              <button onClick={handleSignOut} style={{ padding: '12px 24px', background: 'var(--surface-sub)', border: 'none', borderRadius: '12px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font)' }}>Sign Out</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Active session — full-screen scenario + AAC overlay (Fix 5) ──────────
  return (
    <div style={{ height: '100dvh', width: '100vw', position: 'relative', overflow: 'hidden', background: '#111', fontFamily: 'var(--font)' }}>

      {/* Full-screen scenario stage */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <ScenarioStage backgroundSrc={scenario.background} npcSrc={scenario.npc} npcEmotion={npcEmotion} activeEventText={activeEventText} />
      </div>

      {/* Hidden camera elements — keep running for emotion capture & recording */}
      <video ref={videoRef} muted playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header overlay — 3-col grid: title | mode badge | actions */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        padding: '10px 16px', gap: '8px',
        background: isSurvival ? 'rgba(0,0,0,.72)' : 'rgba(255,255,255,.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${isSurvival ? 'rgba(255,255,255,.1)' : 'var(--border)'}`,
        minHeight: '52px',
      }}>
        {/* Left: scene title */}
        <p style={{ fontSize: '15px', fontWeight: 700, color: isSurvival ? '#fff' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {scenario.title}
        </p>

        {/* Center: mode badge */}
        <span className={isSurvival ? 'badge-survival' : 'badge-learning'} style={{ whiteSpace: 'nowrap' }}>
          {isSurvival ? 'Survival' : 'Learning'}
        </span>

        {/* Right: hearts (survival) + countdown + end */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
          {isSurvival && (
            <>
              <div style={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < hearts ? 'var(--pink)' : isSurvival ? 'rgba(255,255,255,.2)' : '#E0E0E4'}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ))}
              </div>
              <CountdownRing timeLeft={timeLeft} total={SURVIVAL_TIMEOUT_SEC} />
            </>
          )}
          <button onClick={() => endSessionFlow(hearts)}
            style={{ height: '32px', padding: '0 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: isSurvival ? 'rgba(255,255,255,.15)' : 'var(--surface-sub)', color: isSurvival ? '#fff' : 'var(--text-primary)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
            End
          </button>
        </div>
      </header>

      {/* SABI Hint bar — learning mode, fixed below header, above scene */}
      {mode === 'learning' && (
        <div style={{ position: 'absolute', top: '52px', left: 0, right: 0, zIndex: 10 }}>
          <SabiHintBar scenarioId={scenario.id} npcLastMessage={npcResponse} visible={!npcLoading && !!npcResponse} />
        </div>
      )}

      {/* NPC Speech bubble — sits below hint bar */}
      <div style={{ position: 'absolute', top: mode === 'learning' ? '104px' : '52px', left: 0, right: 0, zIndex: 10 }}>
        <SpeechBubble text={npcResponse} loading={npcLoading} />
      </div>

      {/* Survival urgency warning */}
      {isSurvival && timeLeft <= 10 && !npcLoading && (
        <div style={{ position: 'absolute', top: '52px', left: 0, right: 0, zIndex: 10, background: 'rgba(239,68,68,.85)', padding: '6px', textAlign: 'center' }}>
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>
            Hurry! Only {timeLeft}s left!
          </span>
        </div>
      )}

      {/* Recording indicator */}
      {webcamActive && (
        <div style={{ position: 'absolute', top: '60px', right: '16px', zIndex: 11, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '99px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          REC
        </div>
      )}

      {/* AAC trigger — 64×64 image button, centered bottom */}
      <button
        onClick={() => { if (!npcLoading) setBoardOpen(true) }}
        disabled={npcLoading}
        aria-label="Open AAC board"
        style={{
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          width: '64px', height: '64px', borderRadius: '18px',
          border: 'none', cursor: npcLoading ? 'not-allowed' : 'pointer',
          background: npcLoading ? 'rgba(0,0,0,.35)' : isSurvival ? 'var(--pink)' : 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'opacity 0.15s',
          opacity: npcLoading ? 0.5 : 1,
          boxShadow: '0 4px 20px rgba(0,0,0,.35)',
          padding: 0,
          overflow: 'hidden',
        }}>
        {npcLoading ? (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="10" stroke="rgba(255,255,255,.4)" strokeWidth="2.5" />
            <path d="M14 4a10 10 0 019.7 7.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="1s" repeatCount="indefinite" />
            </path>
          </svg>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/assets/icons/aac-device.png"
            alt="AAC"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px' }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement
              el.style.display = 'none'
              const fallback = el.nextSibling as HTMLElement
              if (fallback) fallback.style.display = 'grid'
            }}
          />
        )}
        {/* 4×4 dot grid fallback */}
        <div style={{ display: 'none', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', padding: '12px', position: 'absolute', inset: 0, alignItems: 'center', justifyItems: 'center' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,.9)' }} />
          ))}
        </div>
      </button>

      {/* ── AAC Board Overlay (Fix 5) ── */}
      {boardOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)' }}
          onClick={() => setBoardOpen(false)}
        >
          <div
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X button */}
            <button
              onClick={() => setBoardOpen(false)}
              style={{ position: 'absolute', top: '12px', right: '12px', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-sub)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 3L3 11M3 3l8 8" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {/* Sentence bar: chips left, delete + confirm right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 60px 12px 16px', borderBottom: '1px solid var(--border)', minHeight: '56px', flexShrink: 0 }}>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', minHeight: '32px' }}>
                {selectedIcons.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Select icons to build your message…</span>
                ) : (
                  selectedIcons.map((icon, i) => (
                    <button key={`${icon.id}-${i}`} onClick={() => handleRemoveIcon(i)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--nav-active-bg)', border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background 0.12s' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/icons/${icon.category}/${icon.id}.png`} alt={icon.label} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--nav-active-text)' }}>{icon.label}</span>
                    </button>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {/* Delete last */}
                <button
                  onClick={() => selectedIcons.length > 0 && handleRemoveIcon(selectedIcons.length - 1)}
                  disabled={selectedIcons.length === 0}
                  style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', cursor: selectedIcons.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedIcons.length > 0 ? '#ffeef1' : 'var(--surface-sub)', color: selectedIcons.length > 0 ? '#c0394a' : 'var(--text-muted)', transition: 'background 0.12s' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 5H9L2 12l7 7h11a2 2 0 002-2V7a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M17 9l-5 6M12 9l5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                {/* Confirm / Send */}
                <button
                  onClick={handleSubmit}
                  disabled={selectedIcons.length === 0 || npcLoading}
                  style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', cursor: selectedIcons.length > 0 && !npcLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedIcons.length > 0 && !npcLoading ? 'var(--green)' : 'var(--surface-sub)', color: selectedIcons.length > 0 && !npcLoading ? '#fff' : 'var(--text-muted)', transition: 'background 0.12s' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* AACBoard — tile grid from component, renders API icons only */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AACBoard onIconSelect={handleIconSelect} selectedIds={selectedIcons.map((i) => i.id)} />
            </div>
          </div>
        </div>
      )}

      <canvas ref={captureFrameRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  )
}
