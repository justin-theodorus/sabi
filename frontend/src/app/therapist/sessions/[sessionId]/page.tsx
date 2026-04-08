'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Cell,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'

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

function formatOffset(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function buildEmotionSummary(events: EmotionEvent[]): string {
  if (events.length === 0) return 'No emotion data'
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.dominant_emotion] = (counts[e.dominant_emotion] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([emo, n]) => `${emo} ${Math.round((n / events.length) * 100)}%`)
    .join(', ')
}

// ── Component ─────────────────────────────────────────────────────────────────

function EmotionBarChart({ events }: { events: EmotionEvent[] }) {
  // Tally counts per emotion and convert to sorted percentage data
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.dominant_emotion] = (counts[e.dominant_emotion] ?? 0) + 1
  }
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
      <text x={x + width + 8} y={y + 11} fill="#e5e7eb" fontSize={13} dominantBaseline="middle">
        {item.emoji} {value}%
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={data.length * 44}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 72, left: 8, bottom: 0 }}
        barCategoryGap="30%"
      >
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="emotion"
          width={72}
          tick={({ x, y, payload, index }: any) => (
            <text x={x} y={y} textAnchor="end" fill="#9ca3af" fontSize={13} dominantBaseline="middle">
              {data[index]?.emoji} {payload.value}
            </text>
          )}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
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

export default function SessionReportPage() {
  const router = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()

  const [authToken, setAuthToken] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [emotionEvents, setEmotionEvents] = useState<EmotionEvent[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [scoring, setScoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Auth + fetch data ────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (!authSession) { router.push('/'); return }
      const role = authSession.user.user_metadata?.role
      if (role !== 'therapist') { router.push('/learner'); return }
      setAuthToken(authSession.access_token)
    })
  }, [router])

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
        .in('event_type', ['icon_selection', 'npc_response'])
        .order('timestamp', { ascending: true }),
    ])

    if (sessionRes.error) { setError(sessionRes.error.message); return }
    setSession(sessionRes.data as Session)
    setEmotionEvents((emotionRes.data ?? []) as EmotionEvent[])
    setSessionEvents((eventsRes.data ?? []) as SessionEvent[])
  }, [sessionId])

  useEffect(() => {
    if (authToken) fetchData()
  }, [authToken, fetchData])

  // ── Lazy competence scoring ──────────────────────────────────────────────

  useEffect(() => {
    if (!session || session.competence_scores || !authToken || scoring) return
    if (sessionEvents.length === 0) return

    async function runScoring() {
      setScoring(true)
      try {
        const transcript = sessionEvents!.map((e) => ({
          role: e.event_type === 'icon_selection' ? 'user' : 'assistant',
          content:
            e.event_type === 'icon_selection'
              ? (e.payload.translated as string) ?? (e.payload.icons as string[])?.join(', ')
              : (e.payload.content as string) ?? '',
        }))

        const emotionSummary = buildEmotionSummary(emotionEvents)

        const res = await fetch(`${DIALOGUE_URL}/score-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            emotion_summary: emotionSummary,
            scenario_id: session!.scenario_id,
          }),
        })

        if (!res.ok) return
        const scores: CompetenceScores = await res.json()

        // Cache scores + emotion summary back to Supabase
        await supabase
          .from('sessions')
          .update({ competence_scores: scores, emotion_summary: emotionSummary })
          .eq('id', session!.id)

        setSession((prev) => prev ? { ...prev, competence_scores: scores, emotion_summary: emotionSummary } : prev)
      } catch (err) {
        console.warn('[SessionReport] Scoring error:', err)
      } finally {
        setScoring(false)
      }
    }

    runScoring()
  }, [session, sessionEvents, emotionEvents, authToken, scoring])

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">
        Error: {error}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading…
      </div>
    )
  }

  const scenarioName = SCENARIOS[session.scenario_id]?.title ?? session.scenario_id
  const scores = session.competence_scores

  const radarData = scores
    ? [
        { dimension: 'Operational', value: scores.operational },
        { dimension: 'Linguistic', value: scores.linguistic },
        { dimension: 'Social', value: scores.social },
        { dimension: 'Strategic', value: scores.strategic },
        { dimension: 'Confidence', value: scores.confidence },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center gap-4">
        <Link
          href="/therapist/dashboard"
          className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
        >
          ← Dashboard
        </Link>
        <div className="w-px h-5 bg-gray-600" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <h1 className="text-lg font-bold">Session Report</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Scenario', value: scenarioName },
            { label: 'Mode', value: session.mode === 'survival' ? '💀 Survival' : '📚 Learning' },
            { label: 'Persona', value: PERSONA_LABELS[session.persona_at_time] ?? session.persona_at_time },
            { label: 'Duration', value: formatDuration(session.duration_seconds) },
            { label: 'Date', value: session.started_at ? formatDate(session.started_at) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <div className="text-sm font-medium text-white truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Competence Radar Chart */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h2 className="text-base font-semibold mb-1">Communication Competence</h2>
          {scoring && (
            <p className="text-xs text-gray-400 mb-4">Scoring with AI… this may take a moment.</p>
          )}
          {!scoring && !scores && sessionEvents.length === 0 && (
            <p className="text-xs text-gray-500 mb-4">No session events found to score.</p>
          )}
          {scores && (
            <>
              <p className="text-xs text-gray-400 mb-4">{scores.summary}</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                      labelStyle={{ color: '#e5e7eb' }}
                      formatter={(v: number) => [`${v.toFixed(0)}/100`, 'Score']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-5 gap-2 mt-4">
                {radarData.map(({ dimension, value }) => (
                  <div key={dimension} className="text-center">
                    <div className="text-xs text-gray-400">{dimension}</div>
                    <div className="text-lg font-bold text-blue-400">{value.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Emotion Breakdown */}
        {emotionEvents.length > 0 && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
            <h2 className="text-base font-semibold mb-1">Emotion Breakdown</h2>
            <p className="text-xs text-gray-400 mb-5">
              {emotionEvents.length} samples over {formatDuration(session.duration_seconds)}
            </p>
            <EmotionBarChart events={emotionEvents} />
          </div>
        )}

        {/* Transcript */}
        {sessionEvents.length > 0 && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
            <h2 className="text-base font-semibold mb-4">Session Transcript</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {sessionEvents.map((e) => {
                const isLearner = e.event_type === 'icon_selection'
                const text = isLearner
                  ? `${(e.payload.translated as string) ?? ''} ${
                      (e.payload.icons as string[])?.map((i: string) => `[${i}]`).join(' ') ?? ''
                    }`.trim()
                  : (e.payload.content as string) ?? ''

                return (
                  <div
                    key={e.id}
                    className={`flex ${isLearner ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                        isLearner
                          ? 'bg-blue-900/60 text-blue-100 rounded-bl-sm'
                          : 'bg-gray-700 text-gray-100 rounded-br-sm'
                      }`}
                    >
                      <div className="text-xs opacity-60 mb-1">
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
          <div className="text-center py-8 text-gray-500 text-sm">
            No transcript events recorded for this session.
          </div>
        )}

      </main>
    </div>
  )
}
