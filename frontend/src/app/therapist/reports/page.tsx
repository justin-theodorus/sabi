'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const PERSONA_INFO: Record<string, { label: string; badgeClass: string }> = {
  garang_crab:              { label: 'Garang Crab',    badgeClass: 'badge-hard' },
  shy_chick:                { label: 'Shy Chick',      badgeClass: 'badge-intermediate' },
  zippy_sotong:             { label: 'Zippy Sotong',   badgeClass: 'badge-advanced' },
  curious_monkey:           { label: 'Curious Monkey', badgeClass: 'badge-intermediate' },
  steady_turtle:            { label: 'Steady Turtle',  badgeClass: 'badge-beginner' },
  guided_learner:           { label: 'Guided Learner', badgeClass: 'badge-beginner' },
  social_practice_learner:  { label: 'Social Learner', badgeClass: 'badge-advanced' },
  independent_communicator: { label: 'Independent',    badgeClass: 'badge-beginner' },
}

interface LearnerSummary {
  id: string
  name: string
  email: string
  persona: string | null
  session_count: number
  competence_avg: {
    operational: number
    linguistic: number
    social: number
    strategic: number
    confidence: number
    sessionCount: number
  } | null
}

export default function PatientsPage() {
  const router = useRouter()
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [learners, setLearners]   = useState<LearnerSummary[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      setAuthToken(session.access_token)
    })
  }, [router])

  useEffect(() => {
    if (!authToken) return
    fetch(`${SESSION_URL}/learners/summary`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data) => { setLearners(Array.isArray(data) ? data : []); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [authToken])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>

      <div style={{ padding: '28px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="9" cy="8" r="3.5" fill="#111" opacity=".8" />
            <circle cx="15" cy="7" r="3" fill="#111" opacity=".4" />
            <path d="M1.5 18.5C1.5 15 4.5 12 8 12s6.5 3 6.5 6.5" stroke="#111" strokeWidth="1.7" strokeLinecap="round" opacity=".8" />
            <path d="M13 12c2.5 0 5 2 5 5.5" stroke="#111" strokeWidth="1.6" strokeLinecap="round" opacity=".4" />
          </svg>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>All patients</h1>
        </div>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
      <div style={{ maxWidth: '960px', margin: '0', padding: '0 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>Loading…</div>
        )}
        {error && (
          <div style={{ background: 'var(--diff-hard-bg)', border: '1px solid var(--diff-hard-border)', borderRadius: '16px', padding: '12px 16px', color: 'var(--diff-hard-text)', fontSize: '13px', marginBottom: '16px' }}>
            Failed to load: {error}
          </div>
        )}
        {!loading && learners.length === 0 && !error && (
          <div style={{ background: 'var(--surface)', borderRadius: '22px', padding: '48px 32px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>No learner data yet.</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Reports appear once learners complete sessions.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {learners.map((learner) => {
            const pi = PERSONA_INFO[learner.persona ?? '']

            return (
              <Link key={learner.id} href={`/therapist/reports/${learner.id}`}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '22px', padding: '24px', cursor: 'pointer', textDecoration: 'none', display: 'block', transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s' }}
                className="hover:-translate-y-1 hover:shadow-card-md">

                {/* Avatar */}
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {learner.name[0]}
                </div>

                <p style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px', marginBottom: '4px', color: 'var(--text-primary)' }}>{learner.name}</p>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {learner.session_count} session{learner.session_count !== 1 ? 's' : ''}
                </p>
                {pi && <span className={pi.badgeClass}>{pi.label}</span>}

              </Link>
            )
          })}
        </div>
      </div>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
