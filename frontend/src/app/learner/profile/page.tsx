'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnerBottomNav } from '@/components/LearnerNav'

const PERSONA_INFO: Record<string, { label: string; badgeClass: string; desc: string }> = {
  guided_learner: {
    label: 'Guided Learner',
    badgeClass: 'badge-beginner',
    desc: 'You thrive with hints and step-by-step support. Keep building confidence!',
  },
  social_practice_learner: {
    label: 'Social Practice Learner',
    badgeClass: 'badge-advanced',
    desc: 'You love interactive conversations and learning through social practice.',
  },
  independent_communicator: {
    label: 'Independent Communicator',
    badgeClass: 'badge-intermediate',
    desc: 'You work best independently and tackle challenges head-on.',
  },
}

const SETTINGS = [
  {
    label: 'Notifications',
    value: 'On',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2a5.5 5.5 0 015.5 5.5v2.5l1.5 2H2l1.5-2V7.5A5.5 5.5 0 019 2z" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7 14a2 2 0 004 0" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'NPC Audio',
    value: 'On',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M5 6.5H3a1 1 0 00-1 1v3a1 1 0 001 1h2l4 3.5V3L5 6.5z" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M13 6a3.5 3.5 0 010 6" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Webcam',
    value: 'On',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="11" height="10" rx="2" stroke="var(--text-secondary)" strokeWidth="1.4" />
        <path d="M13 7l3-2v6l-3-2V7z" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Language',
    value: 'English',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="var(--text-secondary)" strokeWidth="1.4" />
        <path d="M9 2c0 0-3.5 2.5-3.5 7s3.5 7 3.5 7" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M9 2c0 0 3.5 2.5 3.5 7s-3.5 7-3.5 7" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M2 9h14" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState('Learner')
  const [email, setEmail] = useState('')
  const [persona, setPersona] = useState<string>('guided_learner')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      const em = session.user.email ?? ''
      const name = em.split('@')[0]
      setEmail(em)
      setUserName(name.charAt(0).toUpperCase() + name.slice(1))

      const { data } = await supabase
        .from('learner_profiles')
        .select('persona')
        .eq('user_id', session.user.id)
        .single()
      if (data?.persona) setPersona(data.persona)

      setAuthChecked(true)
    })
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  const personaInfo = PERSONA_INFO[persona] ?? PERSONA_INFO.guided_learner
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>
      <div style={{ padding: '28px 24px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Profile</h1>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '4px' }}>Your account and settings</p>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)', padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Avatar + name card */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '24px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '22px', background: 'var(--nav-active-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nav-active-text)', fontSize: '22px', fontWeight: 800, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>{userName}</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
            <div style={{ marginTop: '8px' }}>
              <span className={personaInfo.badgeClass}>{personaInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Stats row — 3 equal columns, same baseline, vertical dividers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--surface)', borderRadius: '22px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {[
            { value: '340', label: 'XP' },
            { value: '5',   label: 'Streak' },
            { value: '13',  label: 'Sessions' },
          ].map((stat, i) => (
            <div key={stat.label} style={{ padding: '16px 8px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{stat.value}</p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Persona card */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '20px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="3.5" stroke="var(--text-secondary)" strokeWidth="1.4" />
                <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Communication Style</p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>{personaInfo.label}</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{personaInfo.desc}</p>
        </div>

        {/* Settings list */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</p>
          </div>
          {SETTINGS.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < SETTINGS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {s.icon}
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut}
          style={{ width: '100%', padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', color: 'var(--diff-hard-text)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background 0.15s' }}>
          Sign Out
        </button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '8px' }}>
          SABI · AAC Communication Training · v0.1
        </p>
      </main>

      <LearnerBottomNav />
    </div>
  )
}
