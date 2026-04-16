'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

export default function TherapistProfilePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [therapistName, setTherapistName] = useState('Therapist')
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      const role = session.user.user_metadata?.role
      if (role !== 'therapist') { router.push('/learner'); return }
      const em = session.user.email ?? ''
      const n  = em.split('@')[0]
      setTherapistName(n.charAt(0).toUpperCase() + n.slice(1))
      setEmail(em)
      setAuthChecked(true)
    })
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--blue)', fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font)' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>

      <div style={{ padding: '28px 32px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)', marginBottom: '2px' }}>Profile</h1>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Your account settings</p>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', paddingBottom: 'calc(var(--nav-h) + 32px)', maxWidth: '480px', width: '100%' }}>

        {/* Avatar + name */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '24px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '22px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 800, color: 'var(--text-secondary)', flexShrink: 0 }}>
            {therapistName[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Dr. {therapistName}</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
            <span className="badge-beginner" style={{ marginTop: '8px', display: 'inline-block' }}>Therapist</span>
          </div>
        </div>

        {/* Settings */}
        <div style={{ background: 'var(--surface)', borderRadius: '22px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</p>
          </div>
          {[
            { icon: '🔔', label: 'Notifications', value: 'On' },
            { icon: '🌐', label: 'Language', value: 'English' },
            { icon: '🔒', label: 'Privacy', value: 'Manage' },
          ].map((s, i, arr) => (
            <div key={s.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>{s.icon}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '14px', background: 'var(--surface)',
            border: '1px solid var(--diff-hard-border)', borderRadius: '22px',
            color: 'var(--diff-hard-text)', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background 0.15s',
          }}
        >
          Sign Out
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
          SABI · AAC Communication Training · v0.1
        </p>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
