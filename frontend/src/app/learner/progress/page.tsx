'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnerBottomNav } from '@/components/LearnerNav'

// TODO: replace with real weekly activity data from session service
const WEEKLY_DATA = [
  { day: 'Mon', sessions: 2 },
  { day: 'Tue', sessions: 1 },
  { day: 'Wed', sessions: 3 },
  { day: 'Thu', sessions: 0 },
  { day: 'Fri', sessions: 2 },
  { day: 'Sat', sessions: 4 },
  { day: 'Sun', sessions: 1 },
]

// TODO: replace with real achievement data from session service
const ACHIEVEMENTS = [
  { id: 1, title: 'First Step',  desc: 'Completed your first session',        earned: true },
  { id: 2, title: '3-Day Streak', desc: 'Practised 3 days in a row',          earned: true },
  { id: 3, title: 'Hawker Pro',  desc: 'Finished Hawker Centre 5 times',       earned: false },
  { id: 4, title: 'Survivor',    desc: 'Complete survival mode with 5 hearts', earned: false },
  { id: 5, title: 'Chatterbox',  desc: 'Send 100 messages total',              earned: false },
  { id: 6, title: 'Master',      desc: 'Complete all scenarios',               earned: false },
]

// TODO: replace with real scenario progress data from session service
const SCENARIO_PROGRESS = [
  { id: 'hawker_centre', title: 'Hawker Centre', sessions: 5, pct: 72 },
  { id: 'group_project', title: 'Group Project', sessions: 2, pct: 35 },
  { id: 'queue_shop',    title: 'Queue / Shop',  sessions: 0, pct: 0 },
]

function AchievementIcon({ earned }: { earned: boolean }) {
  if (earned) return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="11" r="7" stroke="#2FB05A" strokeWidth="1.5" />
      <path d="M10.5 11l2.5 2.5 4.5-4.5" stroke="#2FB05A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 18l-1.5 5M18 18l1.5 5" stroke="#2FB05A" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
      <path d="M9 23h10" stroke="#2FB05A" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
    </svg>
  )
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="9" y="12" width="10" height="9" rx="2" stroke="var(--text-muted)" strokeWidth="1.4" />
      <path d="M11 12V10a3 3 0 016 0v2" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="16.5" r="1.2" fill="var(--text-muted)" />
    </svg>
  )
}

export default function ProgressPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState('Learner')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
      } else {
        const email = session.user.email ?? ''
        const name = email.split('@')[0]
        setUserName(name.charAt(0).toUpperCase() + name.slice(1))
        setAuthChecked(true)
      }
    })
  }, [router])

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  const maxSessions = Math.max(...WEEKLY_DATA.map((d) => d.sessions), 1)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>
      <div style={{ padding: '28px 24px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Progress</h1>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '4px' }}>Keep going, {userName}!</p>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)', padding: '16px 250px 0' }}>

        {/* Stats row — 3 equal columns with vertical dividers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--surface)', borderRadius: '22px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '16px' }}>
          {[
            { value: '340', label: 'Total XP' },
            { value: '5',   label: 'Day Streak' },
            { value: '13',  label: 'Sessions' },
          ].map((stat, i) => (
            <div key={stat.label} style={{ padding: '16px 8px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{stat.value}</p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Weekly activity bar chart */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '20px', border: '1px solid var(--border)', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.2px' }}>This Week</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', height: '96px' }}>
            {WEEKLY_DATA.map((d) => (
              <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '72px' }}>
                  <div style={{
                    width: '100%',
                    borderRadius: '6px 6px 0 0',
                    height: `${(d.sessions / maxSessions) * 64}px`,
                    background: d.sessions > 0 ? 'var(--blue)' : 'var(--surface-sub)',
                    minHeight: d.sessions > 0 ? '8px' : '4px',
                    transition: 'height 0.5s',
                  }} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{d.day}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scenario progress */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '20px', border: '1px solid var(--border)', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.2px' }}>Scenarios</p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {SCENARIO_PROGRESS.map((s, i) => (
              <div key={s.id} style={{ borderBottom: i < SCENARIO_PROGRESS.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < SCENARIO_PROGRESS.length - 1 ? '16px' : '0', marginBottom: i < SCENARIO_PROGRESS.length - 1 ? '16px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{s.sessions} sessions · {s.pct}%</span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface-sub)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--blue)', borderRadius: '99px', width: `${s.pct}%`, transition: 'width 0.7s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.3px' }}>Achievements</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} style={{
                background: a.earned ? 'var(--surface)' : 'var(--surface-sub)',
                border: '1px solid var(--border)',
                borderRadius: '22px',
                padding: '16px',
                opacity: a.earned ? 1 : 0.65,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <AchievementIcon earned={a.earned} />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: a.earned ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{a.title}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>{a.desc}</p>
                </div>
                {a.earned && (
                  <span className="badge-beginner" style={{ alignSelf: 'flex-start' }}>Earned</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <LearnerBottomNav />
    </div>
  )
}
