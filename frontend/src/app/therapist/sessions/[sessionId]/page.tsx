'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Cell,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import Image from 'next/image'
import livesImg from '@/assets/Lives.png'
import { CommunicationRadar } from '@/components/CommunicationRadar'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'

const DIALOGUE_URL = process.env.NEXT_PUBLIC_DIALOGUE_URL || 'http://localhost:8001'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id: string
  learner_id: string
  scenario_id: string
  mode: string
  persona_at_time: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  hearts_remaining: number | null
  status: string
  video_url: string | null
  competence_scores: CompetenceScores | null
  emotion_summary: string | null
}

interface CompetenceScores {
  operational: number
  linguistic: number
  social: number
  strategic: number
  confidence: number
  summary: string
}

interface EmotionEvent {
  id: string
  session_offset_ms: number
  dominant_emotion: string
  scores: Record<string, number>
  created_at: string
}

interface SessionEvent {
  id: string
  event_type: string
  payload: Record<string, unknown>
  timestamp: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMOTION_EMOJI: Record<string, string> = {
  happy: '😊', sad: '😢', angry: '😠',
  fear: '😨', surprise: '😲', disgust: '🤢', neutral: '😐',
}

const EMOTION_COLOR: Record<string, string> = {
  happy: '#4ade80', sad: '#60a5fa', angry: '#f87171',
  fear: '#c084fc', surprise: '#fbbf24', disgust: '#a3e635', neutral: '#94a3b8',
}

const PERSONA_LABELS: Record<string, string> = {
  guided_learner: 'Guided Learner',
  social_practice_learner: 'Social Practice',
  independent_communicator: 'Independent Communicator',
}

const COMPETENCE_COLORS: Record<string, string> = {
  Operational: '#7ECFF5',
  Linguistic:  '#4ade80',
  Social:      '#FBBF24',
  Strategic:   '#F87171',
  Confidence:  '#C084FC',
}

function formatDuration(s: number | null): string {
  if (!s) return '—'
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function buildEmotionSummary(events: EmotionEvent[]): string {
  if (events.length === 0) return 'No emotion data'
  const counts: Record<string, number> = {}
  for (const e of events) counts[e.dominant_emotion] = (counts[e.dominant_emotion] ?? 0) + 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([emo, n]) => `${emo} ${Math.round((n / events.length) * 100)}%`)
    .join(', ')
}

// ── Charts (light-theme) ──────────────────────────────────────────────────────

function EmotionBarChart({ events }: { events: EmotionEvent[] }) {
  const counts: Record<string, number> = {}
  for (const e of events) counts[e.dominant_emotion] = (counts[e.dominant_emotion] ?? 0) + 1
  const data = Object.entries(counts)
    .map(([emotion, count]) => ({
      emotion,
      pct: Math.round((count / events.length) * 100),
      emoji: EMOTION_EMOJI[emotion] ?? '',
      color: EMOTION_COLOR[emotion] ?? '#6b7280',
    }))
    .sort((a, b) => b.pct - a.pct)

  const CustomLabel = ({ x, y, width, value, index }: any) => {
    const item = data[index]
    return (
      <text x={x + width + 8} y={y + 11} fill="#6b7280" fontSize={13} dominantBaseline="middle">
        {item.emoji} {value}%
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={data.length * 44}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 8, bottom: 0 }} barCategoryGap="30%">
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category" dataKey="emotion" width={72}
          tick={({ x, y, payload, index }: any) => (
            <text x={x} y={y} textAnchor="end" fill="#6b7280" fontSize={13} dominantBaseline="middle">
              {data[index]?.emoji} {payload.value}
            </text>
          )}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
          formatter={(v: number) => [`${v}%`, 'Share of session']}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} label={<CustomLabel />}>
          {data.map((entry) => (
            <Cell key={entry.emotion} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionReportPage() {
  const router    = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()

  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [therapistName, setTherapistName] = useState('Therapist')
  const [session, setSession]             = useState<Session | null>(null)
  const [emotionEvents, setEmotionEvents] = useState<EmotionEvent[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [scoring, setScoring]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (!authSession) { router.push('/'); return }
      const role = authSession.user.user_metadata?.role
      if (role !== 'therapist') { router.push('/learner'); return }
      const email = authSession.user.email ?? ''
      const name  = email.split('@')[0]
      setTherapistName(name.charAt(0).toUpperCase() + name.slice(1))
      setAuthToken(authSession.access_token)
    })
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const fetchData = useCallback(async () => {
    if (!sessionId) return
    const [sessionRes, emotionRes, eventsRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase
        .from('emotion_events')
        .select('id, session_offset_ms, dominant_emotion, scores, created_at')
        .eq('session_id', sessionId)
        .order('session_offset_ms', { ascending: true }),
      supabase
        .from('session_events')
        .select('id, event_type, payload, timestamp')
        .eq('session_id', sessionId)
        .in('event_type', ['icon_selection', 'npc_response', 'heart_lost'])
        .order('timestamp', { ascending: true }),
    ])
    if (sessionRes.error) { setError(sessionRes.error.message); return }
    setSession(sessionRes.data as Session)
    setEmotionEvents((emotionRes.data ?? []) as EmotionEvent[])
    setSessionEvents((eventsRes.data ?? []) as SessionEvent[])
  }, [sessionId])

  useEffect(() => { if (authToken) fetchData() }, [authToken, fetchData])

  useEffect(() => {
    if (!session || session.competence_scores || !authToken || scoring) return
    if (sessionEvents.length === 0) return

    async function runScoring() {
      setScoring(true)
      try {
        const transcript = sessionEvents.map((e) => ({
          role: e.event_type === 'icon_selection' ? 'user' : 'assistant',
          content: e.event_type === 'icon_selection'
            ? (e.payload.translated as string) ?? (e.payload.icons as string[])?.join(', ')
            : (e.payload.content as string) ?? '',
        }))
        const emotionSummary = buildEmotionSummary(emotionEvents)
        const res = await fetch(`${DIALOGUE_URL}/score-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, emotion_summary: emotionSummary, scenario_id: session!.scenario_id }),
        })
        if (!res.ok) return
        const scores: CompetenceScores = await res.json()
        await supabase.from('sessions').update({ competence_scores: scores, emotion_summary: emotionSummary }).eq('id', session!.id)
        setSession((prev) => prev ? { ...prev, competence_scores: scores, emotion_summary: emotionSummary } : prev)
      } catch (err) {
        console.warn('[SessionReport] Scoring error:', err)
      } finally {
        setScoring(false)
      }
    }
    runScoring()
  }, [session, sessionEvents, emotionEvents, authToken, scoring])

  // ── Loading / error states ────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-rose-500 font-semibold">Error: {error}</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const scenarioName = SCENARIOS[session.scenario_id]?.title ?? session.scenario_id
  const scenarioEmoji = { hawker_centre: '🍜', group_project: '📚', queue_shop: '🛍️' }[session.scenario_id] ?? '🎭'
  const scores    = session.competence_scores
  const isSurvival = session.mode === 'survival'

  // ── Behavioral metrics derived from session_events ───────────────────────
  const iconSelectionEvents = sessionEvents.filter((e) => e.event_type === 'icon_selection')
  const timeoutEvents = sessionEvents.filter(
    (e) => e.event_type === 'heart_lost' && (e.payload.reason as string) === 'timeout'
  )
  const latencies = iconSelectionEvents
    .map((e) => e.payload.response_latency_ms as number | null)
    .filter((v): v is number => typeof v === 'number' && v > 0)
  const avgLatencyMs = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null
  const repairAttempts = iconSelectionEvents.filter((e) => e.payload.is_repair === true).length
  const promptsNeeded = repairAttempts + timeoutEvents.length
  const initiatedFirstTurn = iconSelectionEvents.some((e) => (e.payload.turn_index as number) === 0)

  const radarData = scores
    ? [
        { dimension: 'Operational', value: scores.operational },
        { dimension: 'Linguistic',  value: scores.linguistic },
        { dimension: 'Social',      value: scores.social },
        { dimension: 'Strategic',   value: scores.strategic },
        { dimension: 'Confidence',  value: scores.confidence },
      ]
    : []

  return (
    <div className="min-h-screen bg-white flex flex-col">


      {/* Breadcrumb */}
      <div className="px-5 md:px-8 pt-4 py-3 flex items-center gap-3 bg-white border-b border-gray-100">
        <Link href="/therapist/sessions"
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm font-semibold transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Sessions
        </Link>
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-2xl">{scenarioEmoji}</span>
        <div>
          <span className="text-gray-900 font-extrabold text-sm">Session Report</span>
          <span className="text-gray-400 text-xs ml-2">{scenarioName} · {formatDate(session.started_at)}</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 py-5 space-y-6 max-w-4xl mx-auto w-full">

          {/* Session summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 shadow-sm">
              <span>{scenarioEmoji}</span> {scenarioName}
            </span>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
              isSurvival ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {isSurvival ? '⚔️ Survival' : '📚 Learning'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 shadow-sm">
              👤 {PERSONA_LABELS[session.persona_at_time] ?? session.persona_at_time}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 shadow-sm">
              ⏱ {formatDuration(session.duration_seconds)}
            </span>
            {isSurvival && session.hearts_remaining !== null && (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Image key={i} src={livesImg} alt="life" width={14} height={14}
                    className={`object-contain ${i < session.hearts_remaining! ? '' : 'opacity-20 grayscale'}`} />
                ))}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Turns</p>
              <p className="text-gray-900 text-2xl font-extrabold">
                {sessionEvents.filter(e => e.event_type === 'icon_selection').length}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Duration</p>
              <p className="text-gray-900 text-2xl font-extrabold">{formatDuration(session.duration_seconds)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Emotions</p>
              <p className="text-gray-900 text-2xl font-extrabold">{emotionEvents.length}</p>
              <p className="text-gray-400 text-xs mt-0.5">samples</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Video</p>
              <p className="text-gray-900 text-2xl font-extrabold">{session.video_url ? '✓' : '—'}</p>
            </div>
          </div>

          {/* Competence Radar */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-gray-900 font-extrabold text-base">Communication Competence</h2>
              {scoring && (
                <span className="text-xs text-[#E8714A] font-semibold animate-pulse">Scoring with AI…</span>
              )}
            </div>
            {scores && (
              <p className="text-gray-400 text-xs mb-5">{scores.summary}</p>
            )}
            {!scoring && !scores && sessionEvents.length === 0 && (
              <p className="text-gray-400 text-sm py-4">No session events to score yet.</p>
            )}

            {scores && (
              <>
                <CommunicationRadar scores={radarData} size={260} />

                {/* Per-dimension score list */}
                <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Performance Statistics</p>
                  {radarData.map(({ dimension, value }) => (
                    <div key={dimension} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: COMPETENCE_COLORS[dimension] ?? '#E8714A' }} />
                      <span className="text-sm font-semibold text-gray-700 flex-1">{dimension}</span>
                      <span className="text-sm font-extrabold text-gray-900">{value.toFixed(0)}/10</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Emotion Breakdown */}
          {emotionEvents.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-gray-900 font-extrabold text-base mb-1">Emotion Breakdown</h2>
              <p className="text-gray-400 text-xs mb-5">
                {emotionEvents.length} samples over {formatDuration(session.duration_seconds)}
              </p>
              <EmotionBarChart events={emotionEvents} />
            </div>
          )}

          {/* Transcript */}
          {sessionEvents.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-gray-900 font-extrabold text-base mb-4">Session Transcript</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {sessionEvents.map((e) => {
                  const isLearner = e.event_type === 'icon_selection'
                  const text = isLearner
                    ? `${(e.payload.translated as string) ?? ''} ${(e.payload.icons as string[])?.map((i: string) => `[${i}]`).join(' ') ?? ''}`.trim()
                    : (e.payload.content as string) ?? ''

                  return (
                    <div key={e.id} className={`flex ${isLearner ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm ${
                        isLearner
                          ? 'bg-[#FDE8DC] text-gray-800 rounded-bl-sm'
                          : 'bg-gray-100 text-gray-700 rounded-br-sm'
                      }`}>
                        <div className="text-xs font-semibold mb-1 opacity-60">
                          {isLearner ? '🧑 Learner' : '🤖 NPC'}
                        </div>
                        {text}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {sessionEvents.length === 0 && !scoring && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No transcript events recorded for this session.
            </div>
          )}

      </main>

      <TherapistBottomNav />
    </div>
  )
}
