'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

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
}

const PERSONA_LABELS: Record<string, string> = {
  guided_learner:           'Guided Learner',
  social_practice_learner:  'Social Practice',
  independent_communicator: 'Independent',
  garang_crab:              'Garang Crab',
  shy_chick:                'Shy Chick',
  zippy_sotong:             'Zippy Sotong',
  curious_monkey:           'Curious Monkey',
  steady_turtle:            'Steady Turtle',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
}
function formatDuration(s: number | null) {
  if (!s) return '—'
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
function getScenarioName(id: string) { return SCENARIOS[id]?.title ?? id }

export default function SessionsPage() {
  const router = useRouter()
  const [authToken, setAuthToken]     = useState<string | null>(null)
  const [sessions, setSessions]       = useState<Session[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [filter, setFilter]           = useState<'all' | 'learning' | 'survival'>('all')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      setAuthToken(session.access_token)
    })
  }, [router])

  useEffect(() => {
    if (!authToken) return
    fetch(`${SESSION_URL}/sessions`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data) => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [authToken])

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.mode === filter)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>

      <div style={{ padding: '28px 32px 0' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: '2px' }}>Sessions</h1>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{sessions.length} total</p>
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-sub)', borderRadius: '12px', padding: '4px' }}>
            {(['all', 'learning', 'survival'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding:      '6px 14px',
                  borderRadius: '9px',
                  fontSize:     '12px',
                  fontWeight:   600,
                  border:       'none',
                  cursor:       'pointer',
                  fontFamily:   'var(--font)',
                  transition:   'background 0.15s, color 0.15s',
                  background:   filter === f ? 'var(--surface)' : 'transparent',
                  color:        filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow:    filter === f ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                }}>
                {f === 'all' ? 'All' : f === 'learning' ? 'Learning' : 'Survival'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '0 32px', paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
        {loading && <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>Loading sessions…</div>}
        {error && (
          <div style={{ background: 'var(--diff-hard-bg)', border: '1px solid var(--diff-hard-border)', borderRadius: '16px', padding: '12px 16px', color: 'var(--diff-hard-text)', fontSize: '13px', marginBottom: '16px' }}>
            Failed to load sessions: {error}
          </div>
        )}
        {!loading && filtered.length === 0 && !error && (
          <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '48px 32px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>No sessions yet.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((s) => (
            <div key={s.id} style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px 20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>

              {/* Scenario icon container */}
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="7" width="16" height="12" rx="2.5" stroke="#767676" strokeWidth="1.5" />
                  <path d="M7 7V6a4 4 0 018 0v1" stroke="#767676" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="11" cy="13" r="2" stroke="#767676" strokeWidth="1.3" />
                </svg>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {getScenarioName(s.scenario_id)}
                  </span>
                  <span className={s.mode === 'survival' ? 'badge-survival' : 'badge-learning'}>
                    {s.mode === 'survival' ? 'Survival' : 'Learning'}
                  </span>
                  <span className="badge-neutral">
                    {PERSONA_LABELS[s.persona_at_time] ?? s.persona_at_time}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {formatDate(s.started_at)} · {formatTime(s.started_at)}
                  </span>
                  {s.duration_seconds !== null && (
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                      {formatDuration(s.duration_seconds)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span className={s.status === 'completed' ? 'badge-beginner' : 'badge-neutral'}>
                  {s.status}
                </span>
                {s.status === 'completed' && (
                  <Link href={`/therapist/sessions/${s.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--surface-sub)', borderRadius: '99px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', transition: 'background 0.15s' }}
                    className="hover:bg-[#EAEAEF]">
                    View
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
