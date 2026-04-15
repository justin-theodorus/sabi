'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SCENARIO_LIST } from '@/lib/scenarios'
import { LearnerBottomNav } from '@/components/LearnerNav'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

interface SessionRecord {
  id: string
  scenario_id: string
  mode: string
  status: string
  duration_seconds: number | null
  hearts_remaining: number | null
  started_at: string
}

interface ScenarioStats {
  total: number
  learning: number
  survival: number
  bestHearts: number | null
  lastPlayed: string | null
  pct: number
}

function computeStats(sessions: SessionRecord[], scenarioId: string): ScenarioStats {
  const mine = sessions.filter((s) => s.scenario_id === scenarioId && s.status === 'completed')
  if (mine.length === 0) return { total: 0, learning: 0, survival: 0, bestHearts: null, lastPlayed: null, pct: 0 }
  const learning  = mine.filter((s) => s.mode === 'learning').length
  const survival  = mine.filter((s) => s.mode === 'survival').length
  const hearts    = mine.filter((s) => s.mode === 'survival' && s.hearts_remaining !== null)
  const bestHearts = hearts.length ? Math.max(...hearts.map((s) => s.hearts_remaining!)) : null
  const sorted = [...mine].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  const lastPlayed = sorted[0]?.started_at ?? null
  const pct = Math.min(100, mine.length * 20)
  return { total: mine.length, learning, survival, bestHearts, lastPlayed, pct }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--pink)' : '#E0E0E4'}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

const KNOWN_SCENARIOS = ['hawker_centre', 'group_project', 'queue_shop']

export default function PracticeHubPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken]     = useState<string | null>(null)
  const [sessions, setSessions]       = useState<SessionRecord[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setAuthToken(session.access_token)
      setAuthChecked(true)
    })
  }, [router])

  useEffect(() => {
    if (!authToken) return
    fetch(`${SESSION_URL}/sessions`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSessions(data) })
      .catch(() => {})
  }, [authToken])

  function startSession(scenarioId: string, mode: 'learning' | 'survival') {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedScenario', scenarioId)
      sessionStorage.setItem('selectedMode', mode)
    }
    router.push('/learner/mood')
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  const scenariosToShow = SCENARIO_LIST.filter((s) => KNOWN_SCENARIOS.includes(s.id))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>
      <div style={{ maxWidth: '768px', margin: '0 auto', width: '100%', padding: '28px 24px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Practice</h1>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '4px' }}>Choose a scenario and mode.</p>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
      <div style={{ maxWidth: '768px', margin: '0 auto', width: '100%', padding: '16px 24px 0' }}>

        {/* Mode info tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {/* Learning tile */}
          <div style={{ background: '#f0faf3', border: '1.5px solid var(--green)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#c8ecd4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="#1a6e35" strokeWidth="1.6" />
                <path d="M7 8h10M7 12h10M7 16h6" stroke="#1a6e35" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.2px' }}>Learning</p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Hints · No timer</p>
            </div>
          </div>

          {/* Survival tile */}
          <div style={{ background: '#fff5f6', border: '1.5px solid var(--pink)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ffd6da', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 9h7L16.5 14l2 7L12 17l-6.5 4 2-7L2 9h7L12 2z" stroke="#c0394a" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--pink)', letterSpacing: '-0.2px' }}>Survival</p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>5 hearts · Timer</p>
              <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
                {Array.from({ length: 5 }).map((_, i) => <HeartIcon key={i} filled />)}
              </div>
            </div>
          </div>
        </div>

        {/* Scenario cards */}
        <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '16px' }}>Choose a Scenario</h2>

        <div>
          {scenariosToShow.map((scenario) => {
            const stats = computeStats(sessions, scenario.id)
            return (
              <div key={scenario.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px', marginBottom: '12px' }}>
                <p style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)' }}>{scenario.title}</p>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '4px' }}>{scenario.description}</p>
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginTop: '4px' }}>
                  {stats.total > 0
                    ? `${stats.total} session${stats.total !== 1 ? 's' : ''}${stats.lastPlayed ? ` · Last: ${formatRelative(stats.lastPlayed)}` : ''}`
                    : 'No sessions yet'}
                </p>

                {/* Progress bar */}
                <div style={{ height: '6px', background: 'var(--surface-sub)', borderRadius: '99px', margin: '12px 0', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--green)', borderRadius: '99px', width: `${stats.pct}%`, transition: 'width 0.7s' }} />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => startSession(scenario.id, 'learning')}
                    style={{ flex: 1, height: '48px', borderRadius: '12px', background: '#e6f4ea', color: '#1a6e35', border: '1px solid #a8d5b5', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#1a6e35" strokeWidth="1.4" />
                      <path d="M4.5 5.5h7M4.5 8h7M4.5 10.5h4" stroke="#1a6e35" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    Learning
                  </button>
                  <button onClick={() => startSession(scenario.id, 'survival')}
                    style={{ flex: 1, height: '48px', borderRadius: '12px', background: '#ffeef1', color: '#c0394a', border: '1px solid #ffb3bd', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1.5L9.8 6H14.5l-3.8 2.8 1.5 4.5L8 10.5l-4.2 2.8 1.5-4.5L1.5 6H6.2L8 1.5z" stroke="#c0394a" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    Survival
                  </button>
                </div>
              </div>
            )
          })}

          {/* Coming soon */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px', opacity: 0.45 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Playground</p>
              <span className="badge-neutral">Coming Soon</span>
            </div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Play with friends</p>
            <div style={{ height: '6px', background: 'var(--surface-sub)', borderRadius: '99px', margin: '12px 0' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, height: '48px', borderRadius: '12px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'not-allowed' }}>
                Learning
              </div>
              <div style={{ flex: 1, height: '48px', borderRadius: '12px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'not-allowed' }}>
                Survival
              </div>
            </div>
          </div>
        </div>
      </div>
      </main>

      <LearnerBottomNav />
    </div>
  )
}
