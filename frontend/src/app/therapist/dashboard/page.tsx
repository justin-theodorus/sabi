'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'

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
  video_url: string | null
  competence_scores: Record<string, number> | null
}

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const PERSONA_LABELS: Record<string, string> = {
  guided_learner: 'Guided',
  social_practice_learner: 'Social Practice',
  independent_communicator: 'Independent',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getScenarioName(scenarioId: string): string {
  return SCENARIOS[scenarioId]?.title ?? scenarioId
}

export default function TherapistDashboard() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      const role = session.user.user_metadata?.role
      if (role !== 'therapist') {
        router.push('/learner')
        return
      }
      setAuthToken(session.access_token)
      setAuthChecked(true)
    })
  }, [router])

  useEffect(() => {
    if (!authToken) return
    setLoading(true)
    fetch(`${SESSION_URL}/sessions`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [authToken])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <h1 className="text-xl font-bold">Therapist Dashboard</h1>
        </div>
        <button
          onClick={handleSignOut}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-100">Session History</h2>
          <span className="text-sm text-gray-400">{sessions.length} sessions</span>
        </div>

        {loading && (
          <div className="text-gray-400 text-center py-12">Loading sessions…</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
            Failed to load sessions: {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-4">📋</div>
            <p>No sessions recorded yet.</p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Scenario</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Persona</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Hearts</th>
                  <th className="px-4 py-3 text-left">Video</th>
                  <th className="px-4 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-700/50 hover:bg-gray-750 transition-colors ${
                      i === sessions.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {getScenarioName(s.scenario_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.mode === 'survival'
                            ? 'bg-rose-900/50 text-rose-300'
                            : 'bg-green-900/50 text-green-300'
                        }`}
                      >
                        {s.mode === 'survival' ? '💀 Survival' : '📚 Learning'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {PERSONA_LABELS[s.persona_at_time] ?? s.persona_at_time}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {formatDuration(s.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {s.mode === 'survival'
                        ? `${s.hearts_remaining ?? '?'} / 5 ❤️`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {s.video_url ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'completed' && (
                        <Link
                          href={`/therapist/sessions/${s.id}`}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
                        >
                          View Report
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
