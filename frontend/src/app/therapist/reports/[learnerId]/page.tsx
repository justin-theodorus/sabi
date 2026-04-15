'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { CommunicationRadar } from '@/components/CommunicationRadar'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const PERSONA_INFO: Record<string, { label: string; desc: string; focus: string; badgeClass: string }> = {
  garang_crab:              { label: 'Garang Crab',    badgeClass: 'badge-hard',         desc: 'Confident communicator, high initiation, may rush responses.',   focus: 'Strategic competency.' },
  shy_chick:                { label: 'Shy Chick',      badgeClass: 'badge-intermediate', desc: 'Hesitant communicator, high latency, frequent re-prompts.',       focus: 'Confidence building.' },
  zippy_sotong:             { label: 'Zippy Sotong',   badgeClass: 'badge-advanced',     desc: 'Very energetic but lacks structure, rushes interactions.',         focus: 'Linguistic structure.' },
  curious_monkey:           { label: 'Curious Monkey', badgeClass: 'badge-intermediate', desc: 'Exploratory and playful, tries varied communication patterns.',    focus: 'Operational fluency.' },
  steady_turtle:            { label: 'Steady Turtle',  badgeClass: 'badge-beginner',     desc: 'Reflective and calm, thoughtful moderate-pace engagement.',        focus: 'Social engagement.' },
  guided_learner:           { label: 'Guided Learner', badgeClass: 'badge-beginner',     desc: 'Thrives with hints and step-by-step support.',                     focus: 'Confidence building.' },
  social_practice_learner:  { label: 'Social Learner', badgeClass: 'badge-advanced',     desc: 'Loves interactive conversations and social practice.',             focus: 'Social competency.' },
  independent_communicator: { label: 'Independent',    badgeClass: 'badge-beginner',     desc: 'Works best independently, tackles challenges head-on.',            focus: 'Strategic competency.' },
}

function getDifficultyBadgeClass(mode: string) {
  if (mode === 'survival') return 'badge-hard'
  return 'badge-learning'
}

function getScenarioName(id: string) {
  return SCENARIOS[id]?.title ?? id
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(s: number | null) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
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

export default function LearnerReportPage() {
  const router = useRouter()
  const { learnerId } = useParams<{ learnerId: string }>()

  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [learner, setLearner]             = useState<LearnerDetail | null>(null)
  const [loading, setLoading]             = useState(true)
  const [summaryOpen, setSummaryOpen]     = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      setAuthToken(session.access_token)
    })
  }, [router])

  const fetchData = useCallback(async () => {
    if (!authToken || !learnerId) return
    const res = await fetch(`${SESSION_URL}/learners/${learnerId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (res.ok) setLearner(await res.json())
    setLoading(false)
  }, [authToken, learnerId])

  useEffect(() => { if (authToken) fetchData() }, [authToken, fetchData])

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
  const pi            = PERSONA_INFO[learner?.persona ?? '']
  const completed     = sessions.filter((s) => s.status === 'completed')
  const totalDuration = completed.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--blue)', fontSize: '18px', fontWeight: 700 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>

      {/* Back breadcrumb */}
      <div style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/therapist/reports"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, textDecoration: 'none', transition: 'color 0.15s' }}
          className="hover:text-gray-800">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All patients
        </Link>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Patient dashboard</span>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 32px' }}>

        {/* ── Patient header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
            {learner?.name[0] ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {learner?.name ?? 'Unknown'}
            </div>
            {pi && <span className={pi.badgeClass}>{pi.label}</span>}
          </div>
          <button style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-sub)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0 }}
            className="hover:bg-[#EAEAEF]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total sessions', value: sessions.length.toString() },
            { label: 'Scored', value: scored.length.toString() },
            { label: 'Total time', value: totalDuration > 0 ? `${Math.floor(totalDuration / 60)}m` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: '2px' }}>{value}</div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Persona card ── */}
        {pi && (
          <div style={{ background: '#fff0f2', border: '1px solid #ffc8d0', borderRadius: '16px', padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '24px' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="14" cy="14" r="12" fill="#ffeef1" stroke="#ffb3bd" strokeWidth="1.4" />
              <path d="M9 14c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="#c0394a" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="14" cy="16" r="2" fill="#c0394a" />
            </svg>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#c0394a', marginBottom: '4px' }}>{pi.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {pi.desc} Focus area: <strong>{pi.focus}</strong>
              </div>
              {learner?.persona_confidence != null && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Confidence: {Math.round(learner.persona_confidence * 100)}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── All sessions + Full report — side by side cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* All sessions card */}
          <Link href={`/therapist/sessions?learner=${learnerId}`}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px', cursor: 'pointer', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s', minHeight: '140px' }}
            className="hover:-translate-y-1 hover:shadow-card-md">
            <div style={{ width: '40px', height: '40px', background: 'var(--surface-sub)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2.5" stroke="#555" strokeWidth="1.4" />
                <path d="M5.5 6.5h7M5.5 9h7M5.5 11.5h5" stroke="#555" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>All sessions</div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--blue)' }}>
              View all
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>

          {/* Full report card */}
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '140px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--surface-sub)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="10" height="14" rx="2" stroke="#555" strokeWidth="1.4" />
                <path d="M5 6h5M5 9h4" stroke="#555" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M10 13l2 2 4-4" stroke="#34A853" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Full report</div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {scored.length > 0 ? `${scored.length} scored session${scored.length !== 1 ? 's' : ''}` : 'No scored sessions yet'}
              </div>
            </div>
            {scored.length > 0 && (
              <Link href={`/therapist/sessions/${scored[0].id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--blue)', textDecoration: 'none' }}>
                Latest report
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* ── Communication competence ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '4px' }}>Communication competence</h3>
          {avg && (
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Average across {avg.sessionCount} scored session{avg.sessionCount !== 1 ? 's' : ''} — click a dimension to learn more
            </p>
          )}

          {!avg ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>No scored sessions yet.</p>
          ) : (
            <CommunicationRadar scores={radarScores} size={260} interactive />
          )}

          {/* Summary accordion */}
          {latestSummary && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button
                onClick={() => setSummaryOpen((o) => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 }}>
                Summary
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                  style={{ transform: summaryOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="M5 7.5l5 5 5-5" stroke="#555" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {summaryOpen && (
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '10px' }}>
                  {latestSummary}
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    *Report is generated by AI — last updated based on latest scored session
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Session history ── */}
        {sessions.length > 0 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Recent sessions
            </h3>
            {sessions.slice(0, 8).map((s, i) => (
              <div key={s.id}>
                {/* Date header */}
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', margin: i === 0 ? '0 0 8px' : '20px 0 8px' }}>
                  {formatDate(s.started_at)} &bull; Session {sessions.length - i}
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 20px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {getScenarioName(s.scenario_id)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <span className={s.mode === 'survival' ? 'badge-survival' : 'badge-learning'}>
                      {s.mode === 'survival' ? 'Survival mode' : 'Learning mode'}
                    </span>
                    <span className="badge-neutral">
                      {formatDuration(s.duration_seconds)}
                    </span>
                  </div>
                  {s.status === 'completed' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link href={`/therapist/sessions/${s.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', background: 'var(--surface-sub)', padding: '8px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer', textDecoration: 'none', transition: 'background 0.15s' }}
                        className="hover:bg-[#EAEAEF]">
                        See report
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
