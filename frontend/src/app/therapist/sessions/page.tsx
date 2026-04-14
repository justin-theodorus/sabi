'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'

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
  guided_learner: 'Guided Learner',
  social_practice_learner: 'Social Practice',
  independent_communicator: 'Independent',
  garang_crab: 'Garang Crab',
  shy_chick: 'Shy Chick',
  zippy_sotong: 'Zippy Sotong',
  curious_monkey: 'Curious Monkey',
  steady_turtle: 'Steady Turtle',
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
function getScenarioEmoji(id: string): string {
  return ({ hawker_centre: '🍜', group_project: '📚', queue_shop: '🛍️' } as Record<string,string>)[id] ?? '🎭'
}

export default function SessionsPage() {
  const router = useRouter()
  const [therapistName, setTherapistName] = useState('Therapist')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'learning' | 'survival'>('all')

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

  useEffect(() => {
    if (!authToken) return
    fetch(`${SESSION_URL}/sessions`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data) => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [authToken])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.mode === filter)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 md:px-8 pt-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Sessions</h1>
          <p className="text-gray-500 text-sm">{sessions.length} total</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'learning', 'survival'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize
                ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'all' ? 'All' : f === 'learning' ? '📚 Learning' : '⚔️ Survival'}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 pt-4">
          {loading && <div className="text-center py-16 text-gray-400">Loading sessions…</div>}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-rose-600 text-sm mb-4">
              Failed to load sessions: {error}
            </div>
          )}
          {!loading && filtered.length === 0 && !error && (
            <div className="bg-white rounded-3xl p-12 shadow-sm text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-400 font-semibold">No sessions yet.</p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF8E7] flex items-center justify-center text-2xl flex-shrink-0">
                  {getScenarioEmoji(s.scenario_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-900 font-bold text-sm">{getScenarioName(s.scenario_id)}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.mode === 'survival' ? 'bg-rose-100 text-rose-600' : 'bg-green-100 text-green-700'}`}>
                      {s.mode === 'survival' ? '⚔️ Survival' : '📚 Learning'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      {PERSONA_LABELS[s.persona_at_time] ?? s.persona_at_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-gray-400 text-xs">{formatDate(s.started_at)} · {formatTime(s.started_at)}</span>
                    {s.duration_seconds !== null && (
                      <span className="text-gray-400 text-xs">⏱ {formatDuration(s.duration_seconds)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.status}
                  </span>
                  {s.status === 'completed' && (
                    <Link href={`/therapist/sessions/${s.id}`}
                      className="px-3 py-1.5 bg-[#E8714A] hover:bg-[#d4613c] text-white text-xs rounded-xl transition-colors font-bold">
                      View →
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
