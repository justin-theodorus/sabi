'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { CommunicationRadar } from '@/components/CommunicationRadar'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const PERSONA_INFO: Record<string, { label: string; emoji: string; bg: string; text: string; desc: string; focus: string }> = {
  garang_crab:              { label: 'Garang Crab',   emoji: '🦀', bg: 'bg-rose-50',    text: 'text-rose-700',    desc: 'Confident communicator, high initiation, may rush responses.',   focus: 'Strategic competency.' },
  shy_chick:                { label: 'Shy Chick',     emoji: '🐣', bg: 'bg-yellow-50',  text: 'text-yellow-700',  desc: 'Hesitant communicator, high latency, frequent re-prompts.',       focus: 'Confidence building.' },
  zippy_sotong:             { label: 'Zippy Sotong',  emoji: '🦑', bg: 'bg-purple-50',  text: 'text-purple-700',  desc: 'Very energetic but lacks structure, rushes interactions.',         focus: 'Linguistic structure.' },
  curious_monkey:           { label: 'Curious Monkey',emoji: '🐒', bg: 'bg-orange-50',  text: 'text-orange-700',  desc: 'Exploratory and playful, tries varied communication patterns.',    focus: 'Operational fluency.' },
  steady_turtle:            { label: 'Steady Turtle', emoji: '🐢', bg: 'bg-green-50',   text: 'text-green-700',   desc: 'Reflective and calm, thoughtful moderate-pace engagement.',        focus: 'Social engagement.' },
  guided_learner:           { label: 'Guided Learner',emoji: '🧭', bg: 'bg-blue-50',    text: 'text-blue-700',    desc: 'Thrives with hints and step-by-step support.',                     focus: 'Confidence building.' },
  social_practice_learner:  { label: 'Social Learner',emoji: '🤝', bg: 'bg-purple-50',  text: 'text-purple-700',  desc: 'Loves interactive conversations and social practice.',             focus: 'Social competency.' },
  independent_communicator: { label: 'Independent',   emoji: '🚀', bg: 'bg-emerald-50', text: 'text-emerald-700', desc: 'Works best independently, tackles challenges head-on.',            focus: 'Strategic competency.' },
}

const SESSION_DOT_COLORS = ['#f87171', '#fbbf24', '#60a5fa', '#4ade80', '#c084fc', '#fb923c']

const COMPETENCE_COLORS: Record<string, string> = {
  Operational: '#7ECFF5',
  Linguistic:  '#4ade80',
  Social:      '#FBBF24',
  Strategic:   '#F87171',
  Confidence:  '#C084FC',
}

interface LearnerDetail {
  id: string
  name: string
  email: string
  persona: string | null
  persona_confidence: number | null
  sessions: Session[]
  competence_avg: {
    operational: number; linguistic: number; social: number;
    strategic: number; confidence: number; sessionCount: number
  } | null
}

interface Session {
  id: string
  scenario_id: string
  mode: string
  persona_at_time: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  hearts_remaining: number | null
  status: string
  competence_scores: {
    operational: number; linguistic: number; social: number;
    strategic: number; confidence: number; summary: string
  } | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function formatDuration(s: number | null) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function getScenarioName(id: string) {
  return SCENARIOS[id]?.title ?? id
}

function getScenarioEmoji(id: string): string {
  return ({ hawker_centre: '🍜', group_project: '📚', queue_shop: '🛍️' } as Record<string, string>)[id] ?? '🎭'
}

export default function LearnerReportPage() {
  const router = useRouter()
  const { learnerId } = useParams<{ learnerId: string }>()

  const [therapistName, setTherapistName]   = useState('Therapist')
  const [authToken, setAuthToken]           = useState<string | null>(null)
  const [learner, setLearner]               = useState<LearnerDetail | null>(null)
  const [loading, setLoading]               = useState(true)
  const [summaryOpen, setSummaryOpen]       = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      const role = session.user.user_metadata?.role
      if (role !== 'therapist') { router.push('/learner'); return }
      const email = session.user.email ?? ''
      const n = email.split('@')[0]
      setTherapistName(n.charAt(0).toUpperCase() + n.slice(1))
      setAuthToken(session.access_token)
    })
  }, [router])

  const fetchData = useCallback(async () => {
    if (!authToken || !learnerId) return
    const res = await fetch(`${SESSION_URL}/learners/${learnerId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (res.ok) {
      const data: LearnerDetail = await res.json()
      setLearner(data)
    }
    setLoading(false)
  }, [authToken, learnerId])

  useEffect(() => { if (authToken) fetchData() }, [authToken, fetchData])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const sessions  = learner?.sessions ?? []
  const scored    = sessions.filter((s) => s.status === 'completed' && s.competence_scores)
  const avg       = learner?.competence_avg

  const radarScores = avg ? [
    { dimension: 'Operational', value: avg.operational },
    { dimension: 'Linguistic',  value: avg.linguistic },
    { dimension: 'Social',      value: avg.social },
    { dimension: 'Strategic',   value: avg.strategic },
    { dimension: 'Confidence',  value: avg.confidence },
  ] : []

  const latestSummary = scored[0]?.competence_scores?.summary ?? null
  const pi = PERSONA_INFO[learner?.persona ?? '']

  const completed = sessions.filter(s => s.status === 'completed')
  const totalDuration = completed.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">


      {/* Back breadcrumb */}
      <div className="px-5 md:px-8 pt-4 py-3 flex items-center gap-2 border-b border-gray-100 bg-white">
        <Link href="/therapist/reports"
          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm font-semibold transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Patients
        </Link>
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-gray-900 font-extrabold text-sm">Patient Dashboard</span>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 py-5 max-w-xl space-y-4">

          {/* ── Learner header ── */}
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#FDE8DC] flex items-center justify-center text-[#E8714A] font-extrabold text-2xl flex-shrink-0">
                {learner?.name[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold text-gray-900">{learner?.name ?? 'Unknown'}</h2>
                {pi && (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${pi.bg} ${pi.text}`}>
                    {pi.emoji} {pi.label}
                  </span>
                )}
              </div>
              <Link href="/therapist/learners"
                className="flex items-center gap-1 px-3 py-1.5 bg-[#FDE8DC] text-[#E8714A] text-xs font-bold rounded-xl hover:bg-[#f9d5c0] transition-colors flex-shrink-0">
                Practice Set
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-900">{sessions.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Total Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-900">{scored.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">Scored</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-900">
                  {totalDuration > 0 ? `${Math.floor(totalDuration / 60)}m` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Total Time</p>
              </div>
            </div>
          </div>

          {/* ── Persona card ── */}
          {pi && (
            <div className={`${pi.bg} rounded-2xl p-4 flex items-start gap-3`}>
              <span className="text-2xl flex-shrink-0">{pi.emoji}</span>
              <div>
                <p className={`font-bold text-sm ${pi.text}`}>{pi.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{pi.desc}</p>
                <p className="text-xs text-gray-500 mt-0.5">Focus area: <span className="font-semibold">{pi.focus}</span></p>
                {learner?.persona_confidence != null && (
                  <p className="text-xs text-gray-400 mt-1">
                    Confidence: {Math.round(learner.persona_confidence * 100)}%
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Communication Competence ── */}
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <h3 className="font-extrabold text-gray-900 mb-1 text-base">Communication Competence</h3>
            {avg && (
              <p className="text-xs text-gray-400 mb-4">Average across {avg.sessionCount} scored session{avg.sessionCount !== 1 ? 's' : ''}</p>
            )}

            {!avg ? (
              <p className="text-gray-400 text-sm py-6 text-center">No scored sessions yet.</p>
            ) : (
              <>
                <CommunicationRadar scores={radarScores} size={260} />

                {/* Per-dimension list */}
                <div className="mt-5 space-y-2.5 border-t border-gray-100 pt-4">
                  {radarScores.map(({ dimension, value }) => (
                    <div key={dimension} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: COMPETENCE_COLORS[dimension] }} />
                      <span className="text-sm font-semibold text-gray-700 flex-1">{dimension}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                        <div className="h-full rounded-full"
                          style={{ width: `${value}%`, background: COMPETENCE_COLORS[dimension] }} />
                      </div>
                      <span className="text-sm font-extrabold text-gray-900 w-10 text-right">
                        {Math.round(value / 10)}/10
                      </span>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {latestSummary && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <button onClick={() => setSummaryOpen((o) => !o)}
                      className="w-full flex items-center justify-between text-sm font-bold text-gray-700">
                      Summary
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform ${summaryOpen ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {summaryOpen && (
                      <p className="text-gray-500 text-sm mt-2 leading-relaxed">{latestSummary}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Recent Practice ── */}
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <h3 className="font-extrabold text-gray-900 mb-4 text-base">Recent Practice</h3>
            {sessions.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No sessions yet.</p>
            )}
            <div className="space-y-3">
              {sessions.slice(0, 8).map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: SESSION_DOT_COLORS[i % SESSION_DOT_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {getScenarioEmoji(s.scenario_id)} {getScenarioName(s.scenario_id)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{formatDate(s.started_at)}</p>
                      {s.duration_seconds && (
                        <p className="text-xs text-gray-300">· {formatDuration(s.duration_seconds)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      s.mode === 'survival' ? 'bg-rose-100 text-rose-600' : 'bg-green-100 text-green-700'
                    }`}>
                      {s.mode === 'survival' ? 'Survival' : 'Learning'}
                    </span>
                    {s.status === 'completed' && (
                      <Link href={`/therapist/sessions/${s.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-[#E8714A] hover:underline">
                        See report
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

      </main>

      <TherapistBottomNav />
    </div>
  )
}
