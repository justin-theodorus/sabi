'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

interface DashboardSession {
  id: string
  learner_id: string
  learner_name: string
  scenario_id: string
  mode: string
  started_at: string
  status: string
}

function getScenarioName(id: string) {
  return SCENARIOS[id]?.title ?? id.replace(/_/g, ' ')
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function WeekCalendar() {
  const today        = new Date()
  const day          = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday       = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  const days   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const monthLabel = today.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })

  return (
    <div>
      <p style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-0.2px', marginBottom: '14px', color: 'var(--text-primary)' }}>
        {monthLabel}
      </p>
      <div className="grid grid-cols-7 text-center" style={{ rowGap: '4px' }}>
        {LABELS.map((l) => (
          <span key={l} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', paddingBottom: '6px', letterSpacing: '.05em' }}>
            {l}
          </span>
        ))}
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString()
          return (
            <div key={i} className="flex flex-col items-center">
              <span
                style={{
                  width: '36px', height: '36px',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: isToday ? 800 : 600,
                  background: isToday ? '#EFEFEF' : 'transparent',
                  color: 'var(--text-primary)',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {d.getDate()}
              </span>
              {isToday && (
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#E53935', marginTop: '2px', display: 'block' }} />
              )}
            </div>
          )
        })}
      </div>
      <button style={{ display: 'block', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '10px', background: 'none', border: 'none', width: '100%', fontFamily: 'var(--font)' }}>
        See calendar →
      </button>
    </div>
  )
}

function SessionRow({ s, showArrow = false }: { s: DashboardSession; showArrow?: boolean }) {
  const initial = (s.learner_name ?? '?')[0].toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}
      className="last:border-b-0">
      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--surface-sub)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.learner_name}</div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getScenarioName(s.scenario_id)}
        </div>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--surface-sub)', padding: '5px 11px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--text-primary)' }}>
        {formatTime(s.started_at)}
      </span>
      {showArrow && (
        <Link href={`/therapist/sessions/${s.id}`}
          style={{ width: '36px', height: '36px', background: '#111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.18s cubic-bezier(.34,1.56,.64,1), background 0.15s' }}
          className="hover:bg-[#2a2a2a] hover:scale-110 active:scale-95">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M7 3.5l3.5 3.5L7 10.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
    </div>
  )
}

export default function TherapistDashboard() {
  const router = useRouter()
  const [authChecked, setAuthChecked]     = useState(false)
  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [therapistName, setTherapistName] = useState('Therapist')
  const [recentSessions, setRecentSessions] = useState<DashboardSession[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      const role = session.user.user_metadata?.role
      if (role !== 'therapist') { router.push('/learner'); return }
      const email = session.user.email ?? ''
      const n = email.split('@')[0]
      setTherapistName(n.charAt(0).toUpperCase() + n.slice(1))
      setAuthToken(session.access_token)
      setAuthChecked(true)
    })
  }, [router])

  useEffect(() => {
    if (!authToken) return
    fetch(`${SESSION_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data.recentSessions) setRecentSessions(data.recentSessions) })
      .catch(() => {})
  }, [authToken])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div style={{ color: 'var(--blue)', fontSize: '18px', fontWeight: 700 }}>Loading…</div>
      </div>
    )
  }

  const todaySessions  = recentSessions.filter(
    (s) => new Date(s.started_at).toDateString() === new Date().toDateString()
  )
  const latestSessions = recentSessions.slice(0, 5)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Two-column layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', paddingBottom: 'var(--nav-h)' }}>

        {/* ── Left main column ── */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '28px 32px 32px', background: 'var(--surface)' }}>

          {/* Search + bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="sabi-input"
                type="text"
                placeholder="Search"
                style={{ paddingRight: '44px' }}
              />
              <svg style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="#AAAAAA" strokeWidth="1.6" />
                <path d="M10.5 10.5L14 14" stroke="#AAAAAA" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <button style={{ width: '44px', height: '44px', flexShrink: 0, background: 'var(--surface-sub)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'background 0.15s' }}
              className="hover:bg-[#EAEAEF]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5C6.1 1.5 3.75 3.85 3.75 6.75v1.5L2.25 10.5v.75h13.5v-.75l-1.5-2.25v-1.5C14.25 3.85 11.9 1.5 9 1.5z" stroke="#555" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M7.5 12a1.5 1.5 0 003 0" stroke="#555" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span style={{ width: '10px', height: '10px', background: 'var(--blue)', border: '2.5px solid var(--surface-sub)', borderRadius: '50%', position: 'absolute', top: '8px', right: '8px' }} />
            </button>
          </div>

          {/* Greeting */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '27px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: 'var(--text-primary)' }}>
              {getGreeting()}, Dr. {therapistName}!
            </h1>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              smgt {therapistName.toLowerCase()}
            </span>
          </div>

          {/* 3 action cards — strict 4-part column stack */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>

            {/* See my patients — blue */}
            <Link href="/therapist/reports"
              style={{ borderRadius: '22px', padding: '24px', minHeight: '244px', display: 'flex', flexDirection: 'column', cursor: 'pointer', background: 'var(--blue)', textDecoration: 'none', transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s' }}
              className="action-card">
              <div className="action-card-icon">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="10" cy="9" r="3.5" fill="#111" opacity=".8" />
                  <circle cx="17.5" cy="9" r="3" fill="#111" opacity=".4" />
                  <path d="M2.5 21.5C2.5 17.634 5.634 14.5 10 14.5" stroke="#111" strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
                  <path d="M11.5 21.5c0-3.866 2.91-7 6.5-7s6.5 3.134 6.5 7" stroke="#111" strokeWidth="1.7" strokeLinecap="round" opacity=".4" />
                </svg>
              </div>
              <div className="action-card-spacer" />
              <div className="action-card-body">
                <h2>See my patients</h2>
                <p>Click to manage patients</p>
              </div>
              <button className="cta-circle" onClick={(e) => e.preventDefault()}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M10 5l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </Link>

            {/* See reports — yellow */}
            <Link href="/therapist/reports"
              style={{ borderRadius: '22px', padding: '24px', minHeight: '244px', display: 'flex', flexDirection: 'column', cursor: 'pointer', background: 'var(--yellow)', textDecoration: 'none', transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s' }}
              className="action-card">
              <div className="action-card-icon">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <rect x="5" y="3" width="16" height="20" rx="2.5" stroke="#111" strokeWidth="1.8" />
                  <path d="M9 9h8M9 13h8M9 17h5" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div className="action-card-spacer" />
              <div className="action-card-body">
                <h2>See reports</h2>
                <p>AI summary from patients' latest sessions</p>
              </div>
              <button className="cta-circle" onClick={(e) => e.preventDefault()}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M10 5l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </Link>

            {/* Scenario Library — pink */}
            <Link href="/therapist/scenarios"
              style={{ borderRadius: '22px', padding: '24px', minHeight: '244px', display: 'flex', flexDirection: 'column', cursor: 'pointer', background: 'var(--pink)', textDecoration: 'none', transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s' }}
              className="action-card">
              <div className="action-card-icon">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <rect x="3" y="7" width="20" height="15" rx="2.5" stroke="#111" strokeWidth="1.8" />
                  <path d="M9 7V6a4 4 0 018 0v1" stroke="#111" strokeWidth="1.7" strokeLinecap="round" />
                  <path d="M9.5 15.5l2 2 5-5" stroke="#111" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="action-card-spacer" />
              <div className="action-card-body">
                <h2>Scenario library</h2>
                <p>See existing scenarios and create new ones</p>
              </div>
              <button className="cta-circle" onClick={(e) => e.preventDefault()}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M10 5l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </Link>
          </div>
        </div>

        {/* ── Right sidebar — calendar + schedule ── */}
        {/* Note: profile/settings intentionally excluded from sidebar per design spec */}
        <div style={{ width: '320px', flexShrink: 0, background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: '28px 24px 32px' }}>

          {/* Dr. name row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginBottom: '28px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Dr. {therapistName}</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="8" r="4" fill="#AAAAAA" />
                <path d="M3 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#AAAAAA" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Calendar */}
          <WeekCalendar />

          {/* Today's schedule */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.15px', color: 'var(--text-primary)' }}>Today's schedule</h3>
            </div>
            {todaySessions.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No sessions today.</p>
            ) : (
              <div>
                {todaySessions.slice(0, 3).map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            )}
          </div>

          {/* Latest sessions */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.15px', color: 'var(--text-primary)' }}>Latest sessions</h3>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>See all patients' practice sessions.</p>
            </div>
            {latestSessions.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No sessions yet.</p>
            ) : (
              <div>
                {latestSessions.map((s) => (
                  <SessionRow key={s.id} s={s} showArrow />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TherapistBottomNav />
    </div>
  )
}
