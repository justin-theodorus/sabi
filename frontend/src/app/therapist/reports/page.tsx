'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TherapistBottomNav } from '@/components/TherapistSidebar'
import { CommunicationRadar } from '@/components/CommunicationRadar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const PERSONA_INFO: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  garang_crab:              { label: 'Garang Crab',    emoji: '🦀', bg: 'bg-rose-50',    text: 'text-rose-700' },
  shy_chick:                { label: 'Shy Chick',      emoji: '🐣', bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  zippy_sotong:             { label: 'Zippy Sotong',   emoji: '🦑', bg: 'bg-purple-50',  text: 'text-purple-700' },
  curious_monkey:           { label: 'Curious Monkey', emoji: '🐒', bg: 'bg-orange-50',  text: 'text-orange-700' },
  steady_turtle:            { label: 'Steady Turtle',  emoji: '🐢', bg: 'bg-green-50',   text: 'text-green-700' },
  guided_learner:           { label: 'Guided Learner', emoji: '🧭', bg: 'bg-blue-50',    text: 'text-blue-700' },
  social_practice_learner:  { label: 'Social Learner', emoji: '🤝', bg: 'bg-purple-50',  text: 'text-purple-700' },
  independent_communicator: { label: 'Independent',    emoji: '🚀', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const COMPETENCE_COLORS: Record<string, string> = {
  Operational: '#7ECFF5',
  Linguistic:  '#4ade80',
  Social:      '#FBBF24',
  Strategic:   '#F87171',
  Confidence:  '#C084FC',
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
      .then((data) => {
        setLearners(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [authToken])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 md:px-8 pt-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Patients</h1>
        <p className="text-gray-400 text-sm mt-1">Communication competence per learner</p>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 pt-4 max-w-5xl mx-auto w-full">
        {loading && (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-rose-600 text-sm mb-4">
            Failed to load: {error}
          </div>
        )}

        {!loading && learners.length === 0 && !error && (
          <div className="bg-white rounded-3xl p-12 shadow-sm text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-400 font-semibold">No learner data yet.</p>
            <p className="text-gray-300 text-sm mt-1">Reports appear once learners complete sessions.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {learners.map((learner) => {
            const pi = PERSONA_INFO[learner.persona ?? '']
            const avg = learner.competence_avg

            const radarData = avg ? [
              { dimension: 'Operational', value: avg.operational },
              { dimension: 'Linguistic',  value: avg.linguistic },
              { dimension: 'Social',      value: avg.social },
              { dimension: 'Strategic',   value: avg.strategic },
              { dimension: 'Confidence',  value: avg.confidence },
            ] : null

            return (
              <Link
                key={learner.id}
                href={`/therapist/reports/${learner.id}`}
                className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow block"
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg flex-shrink-0"
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                  >
                    {learner.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-gray-900 text-base truncate">{learner.name}</p>
                    {pi && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${pi.bg} ${pi.text} mt-0.5`}>
                        {pi.emoji} {pi.label}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {learner.session_count} session{learner.session_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Pentagon radar */}
                {radarData ? (
                  <>
                    <div className="flex justify-center my-1">
                      <CommunicationRadar scores={radarData} size={200} />
                    </div>

                    {/* Score bars */}
                    <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
                      {radarData.map(({ dimension, value }) => (
                        <div key={dimension} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: COMPETENCE_COLORS[dimension] }}
                          />
                          <span className="text-xs text-gray-500 w-20 flex-shrink-0">{dimension}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${value}%`, background: COMPETENCE_COLORS[dimension] }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-8 text-right">
                            {Math.round(value / 10)}/10
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Avg across {avg!.sessionCount} scored session{avg!.sessionCount !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-300 text-sm">
                    No scored sessions yet
                  </div>
                )}

                <div className="flex items-center justify-end pt-3 border-t border-gray-100 mt-3">
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                    Full report →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
