'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { CommunicationRadar } from '@/components/CommunicationRadar'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

const DIALOGUE_URL = process.env.NEXT_PUBLIC_DIALOGUE_URL || 'http://localhost:8001'

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

const EMOTION_COLOR: Record<string, string> = {
  happy:    '#4ade80',
  sad:      '#60a5fa',
  angry:    '#f87171',
  fear:     '#c084fc',
  surprise: '#fbbf24',
  disgust:  '#a3e635',
  neutral:  '#94a3b8',
}

const PERSONA_LABELS: Record<string, string> = {
  guided_learner:           'Guided Learner',
  social_practice_learner:  'Social Practice',
  independent_communicator: 'Independent Communicator',
  garang_crab:              'Garang Crab',
  shy_chick:                'Shy Chick',
  zippy_sotong:             'Zippy Sotong',
  curious_monkey:           'Curious Monkey',
  steady_turtle:            'Steady Turtle',
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

function EmotionBarChart({ events }: { events: EmotionEvent[] }) {
  const counts: Record<string, number> = {}
  for (const e of events) counts[e.dominant_emotion] = (counts[e.dominant_emotion] ?? 0) + 1
  const data = Object.entries(counts)
    .map(([emotion, count]) => ({
      emotion,
      pct:   Math.round((count / events.length) * 100),
      color: EMOTION_COLOR[emotion] ?? '#767676',
    }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <ResponsiveContainer width="100%" height={data.length * 44}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 8, bottom: 0 }} barCategoryGap="30%">
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="emotion" width={72}
          tick={({ x, y, payload }: any) => (
            <text x={x} y={y} textAnchor="end" fill="var(--text-secondary)" fontSize={13} dominantBaseline="middle">
              {payload.value}
            </text>
          )}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
          formatter={(v: number) => [`${v}%`, 'Share of session']}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}
          label={({ x, y, width, value }: any) => (
            <text x={x + width + 8} y={y + 11} fill="var(--text-secondary)" fontSize={13} dominantBaseline="middle">
              {value}%
            </text>
          )}
        >
          {data.map((entry) => (
            <Cell key={entry.emotion} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function YesNoBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <div style={{ background: value ? '#f0faf3' : '#fff5f6', borderRadius: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: value ? 'var(--green)' : 'var(--pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {value ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M7 3L3 7M3 3l4 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: '15px', fontWeight: 800, color: value ? 'var(--green)' : 'var(--pink)' }}>
          {value ? 'Yes' : 'No'}
        </span>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  )
}

export default function SessionReportPage() {
  const router = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()

  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [session, setSession]             = useState<Session | null>(null)
  const [learnerName, setLearnerName]     = useState<string>('Unknown')
  const [emotionEvents, setEmotionEvents] = useState<EmotionEvent[]>([])
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([])
  const [heartEvents, setHeartEvents]     = useState<SessionEvent[]>([])
  const [scoring, setScoring]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      if (!authSession) { router.push('/'); return }
      if (authSession.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      setAuthToken(authSession.access_token)
    })
  }, [router])

  const fetchData = useCallback(async () => {
    if (!sessionId) return
    const [sessionRes, emotionRes, eventsRes, heartRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('emotion_events').select('id, session_offset_ms, dominant_emotion, scores, created_at').eq('session_id', sessionId).order('session_offset_ms', { ascending: true }),
      supabase.from('session_events').select('id, event_type, payload, timestamp').eq('session_id', sessionId).in('event_type', ['icon_selection', 'npc_response']).order('timestamp', { ascending: true }),
      supabase.from('session_events').select('id, event_type, payload, timestamp').eq('session_id', sessionId).eq('event_type', 'heart_lost').order('timestamp', { ascending: true }),
    ])
    if (sessionRes.error) { setError(sessionRes.error.message); return }
    const s = sessionRes.data as Session
    setSession(s)
    setEmotionEvents((emotionRes.data ?? []) as EmotionEvent[])
    setSessionEvents((eventsRes.data ?? []) as SessionEvent[])
    setHeartEvents((heartRes.data ?? []) as SessionEvent[])

    // Fetch learner name
    const { data: profile } = await supabase
      .from('learner_profiles')
      .select('name')
      .eq('user_id', s.learner_id)
      .single()
    if (profile?.name) setLearnerName(profile.name)
  }, [sessionId])

  useEffect(() => { if (authToken) fetchData() }, [authToken, fetchData])

  useEffect(() => {
    if (!session || session.competence_scores || !authToken || scoring) return
    if (sessionEvents.length === 0) return

    async function runScoring() {
      setScoring(true)
      try {
        const transcript = sessionEvents.map((e) => ({
          role:    e.event_type === 'icon_selection' ? 'user' : 'assistant',
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

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: '#c0394a', fontWeight: 600 }}>Error: {error}</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--blue)', fontSize: '18px', fontWeight: 700 }}>Loading…</div>
      </div>
    )
  }

  const scenarioName = SCENARIOS[session.scenario_id]?.title ?? session.scenario_id
  const scores       = session.competence_scores
  const isSurvival   = session.mode === 'survival'

  // Computed metrics
  const iconSelectionEvents = sessionEvents.filter((e) => e.event_type === 'icon_selection')
  const turns        = iconSelectionEvents.length
  const reprompts    = heartEvents.length
  const firstEvent   = sessionEvents[0]
  const userInitiated = !!firstEvent && firstEvent.event_type === 'icon_selection'
  const repairedMisunderstanding = heartEvents.length > 0 && heartEvents.some((hEvent) =>
    sessionEvents.some((iEvent) =>
      iEvent.event_type === 'icon_selection' &&
      new Date(iEvent.timestamp) > new Date(hEvent.timestamp)
    )
  )

  const radarData = scores ? [
    { dimension: 'Operational', value: scores.operational },
    { dimension: 'Linguistic',  value: scores.linguistic },
    { dimension: 'Social',      value: scores.social },
    { dimension: 'Strategic',   value: scores.strategic },
    { dimension: 'Confidence',  value: scores.confidence },
  ] : []

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>

      {/* Breadcrumb */}
      <div style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/therapist/sessions"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
          className="hover:text-gray-800">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sessions
        </Link>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
        <div>
          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>Session report</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>{scenarioName} · {formatDate(session.started_at)}</span>
        </div>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Session hero card — with learner info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px' }}>

          {/* Learner info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
              {learnerName[0] ?? '?'}
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{learnerName}</p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Learner</p>
            </div>
          </div>

          {/* Session info */}
          <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '4px', color: 'var(--text-primary)' }}>{scenarioName}</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {formatDate(session.started_at)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span className={isSurvival ? 'badge-survival' : 'badge-learning'}>
              {isSurvival ? 'Survival mode' : 'Learning mode'}
            </span>
            <span className="badge-neutral">
              {PERSONA_LABELS[session.persona_at_time] ?? session.persona_at_time}
            </span>
          </div>
        </div>

        {/* Performance Statistics */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Performance statistics
          </h2>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>

            {/* Time taken */}
            <div style={{ background: 'var(--surface-sub)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(125,178,246,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="var(--blue)" strokeWidth="1.4" />
                  <path d="M7 4v3l2 1.5" stroke="var(--blue)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                {formatDuration(session.duration_seconds)}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Time taken</div>
            </div>

            {/* Turns */}
            <div style={{ background: 'var(--surface-sub)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(47,176,90,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M9 4l3 3-3 3" stroke="var(--green)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                {turns}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Turns taken</div>
            </div>

            {/* Re-prompts */}
            <div style={{ background: reprompts > 0 ? '#fff5f6' : 'var(--surface-sub)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: reprompts > 0 ? 'rgba(255,147,161,.2)' : 'rgba(170,170,170,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M12 2L2 12M2 2l10 10" stroke={reprompts > 0 ? 'var(--pink)' : 'var(--text-muted)'} strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: reprompts > 0 ? 'var(--pink)' : 'var(--text-primary)', marginBottom: '2px' }}>
                {reprompts}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: reprompts > 0 ? 'var(--pink)' : 'var(--text-secondary)' }}>Re-prompts needed</div>
            </div>

            {/* Hearts (survival only) */}
            {isSurvival && session.hearts_remaining !== null && (
              <div style={{ background: '#ffeef1', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < session.hearts_remaining! ? 'var(--pink)' : 'rgba(192,57,74,.2)'}>
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  ))}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: '#c0394a', marginBottom: '2px' }}>
                  {session.hearts_remaining}/5
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#c0394a' }}>Hearts remaining</div>
              </div>
            )}
          </div>

          {/* Yes/No behavioural metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <YesNoBadge value={userInitiated} label="Initiated conversation" />
            <YesNoBadge value={repairedMisunderstanding} label="Repaired misunderstanding" />
          </div>

          {/* Session recording */}
          {session.video_url && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Session recording</p>
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={session.video_url}
                  preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onLoadedMetadata={(e) => {
                    // Seek to 1s to get a meaningful thumbnail frame
                    const vid = e.currentTarget
                    vid.currentTime = 1
                  }}
                />
                <a
                  href={session.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.35)', textDecoration: 'none' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M5 3.5l10 5.5-10 5.5V3.5z" fill="#111" />
                    </svg>
                  </div>
                </a>
              </div>
              <Link
                href={`/therapist/sessions/${sessionId}/recording`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '13px', fontWeight: 700, color: 'var(--blue)', textDecoration: 'none' }}>
                Open recording page →
              </Link>
            </div>
          )}
        </div>

        {/* Communication competence radar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)' }}>
              Communication competence
            </h2>
            {scoring && (
              <span style={{ fontSize: '12px', color: 'var(--blue)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                Scoring with AI…
              </span>
            )}
          </div>
          {scores && (
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {scores.summary}
            </p>
          )}
          {!scoring && !scores && sessionEvents.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '16px 0' }}>No session events to score yet.</p>
          )}
          {scores && (
            <CommunicationRadar scores={radarData} size={260} interactive />
          )}
        </div>

        {/* Emotion breakdown */}
        {emotionEvents.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Emotion breakdown
            </h2>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {emotionEvents.length} samples over {formatDuration(session.duration_seconds)}
            </p>
            <EmotionBarChart events={emotionEvents} />
          </div>
        )}

        {/* Session transcript */}
        {sessionEvents.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Session transcript
            </h2>
            <div style={{ maxHeight: '384px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessionEvents.map((e) => {
                const isLearner = e.event_type === 'icon_selection'
                const text = isLearner
                  ? `${(e.payload.translated as string) ?? ''} ${(e.payload.icons as string[])?.map((i: string) => `[${i}]`).join(' ') ?? ''}`.trim()
                  : (e.payload.content as string) ?? ''

                return (
                  <div key={e.id} style={{ display: 'flex', justifyContent: isLearner ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '72%',
                      padding: '10px 14px',
                      borderRadius: isLearner ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                      fontSize: '14px',
                      fontWeight: 500,
                      lineHeight: 1.5,
                      background: isLearner ? 'var(--surface-sub)' : 'var(--nav-active-bg)',
                      color: 'var(--text-primary)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        {isLearner ? learnerName : 'NPC'}
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
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No transcript events recorded for this session.
          </div>
        )}
      </div>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
