'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SCENARIO_LIST } from '@/lib/scenarios'
import { LearnerHeader, LearnerBottomNav } from '@/components/LearnerNav'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const SCENE_META: Record<string, { emoji: string; bg: string }> = {
  hawker_centre: { emoji: '🍜', bg: 'bg-[#FFF8E7]' },
  group_project:  { emoji: '📚', bg: 'bg-[#E8F4F8]' },
  queue_shop:     { emoji: '🛍️', bg: 'bg-[#EEF6EE]' },
}

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
  /** 0-100 rough completion score */
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
  // rough pct: cap at 100, each session adds ~20%
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

export default function PracticeHubPage() {
  const router   = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken]     = useState<string | null>(null)
  const [userName, setUserName]       = useState('Learner')
  const [sessions, setSessions]       = useState<SessionRecord[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      const email = session.user.email ?? ''
      const name  = email.split('@')[0]
      setUserName(name.charAt(0).toUpperCase() + name.slice(1))
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
    router.push('/learner/session')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 md:px-8 pt-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Hi, {userName}!</h1>
        <p className="text-gray-400 text-sm mt-1">Choose a scenario and mode.</p>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 space-y-6 pt-4">

          {/* Mode legend cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">📚</div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-bold text-sm">Learning Mode</p>
                <p className="text-gray-400 text-xs mt-0.5">Hints available · No timer · Low pressure</p>
              </div>
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-xs font-bold">✓</span>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">⚔️</div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-bold text-sm">Survival Mode</p>
                <p className="text-gray-400 text-xs mt-0.5">5 lives · 30s timer · No hints</p>
              </div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <span key={i} className="text-xs">❤️</span>)}
              </div>
            </div>
          </div>

          {/* Scenario cards with progress */}
          <div>
            <h2 className="text-gray-900 text-xl font-extrabold mb-3">Choose a Scenario</h2>
            <div className="space-y-3">
              {SCENARIO_LIST.filter((s) => SCENE_META[s.id]).map((scenario) => {
                const meta  = SCENE_META[scenario.id]!
                const stats = computeStats(sessions, scenario.id)

                return (
                  <div key={scenario.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                    {/* Scenario header with progress */}
                    <div className={`${meta.bg} px-5 pt-4 pb-3`}>
                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-4xl">{meta.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 font-extrabold text-base">{scenario.title}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{scenario.description}</p>
                        </div>
                        {/* Session count badge */}
                        {stats.total > 0 && (
                          <div className="flex-shrink-0 text-right">
                            <p className="text-gray-900 font-extrabold text-base">{stats.total}</p>
                            <p className="text-gray-400 text-[10px]">session{stats.total !== 1 ? 's' : ''}</p>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      {stats.total > 0 ? (
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
                            <span className="flex gap-2">
                              {stats.learning > 0 && <span>📚 {stats.learning} learning</span>}
                              {stats.survival > 0 && <span>⚔️ {stats.survival} survival</span>}
                            </span>
                            {stats.lastPlayed && <span>Last: {formatRelative(stats.lastPlayed)}</span>}
                          </div>
                          <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#E8714A] rounded-full transition-all duration-700"
                              style={{ width: `${stats.pct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs">No sessions yet — start below!</p>
                      )}
                    </div>

                    {/* Mode buttons */}
                    <div className="flex gap-3 px-5 py-4">
                      <button
                        onClick={() => startSession(scenario.id, 'learning')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 text-green-700 font-bold text-sm transition-all active:scale-95"
                      >
                        <span>📚</span>
                        Learning
                      </button>
                      <button
                        onClick={() => startSession(scenario.id, 'survival')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 hover:border-rose-400 text-rose-600 font-bold text-sm transition-all active:scale-95"
                      >
                        <span>⚔️</span>
                        Survival
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Coming soon */}
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden opacity-50">
                <div className="bg-[#F5EEFF] px-5 py-4 flex items-center gap-4">
                  <span className="text-4xl">🎪</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 font-extrabold text-base">Playground</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-400 text-white rounded-full">SOON</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">Play with friends</p>
                  </div>
                </div>
                <div className="flex gap-3 px-5 py-4">
                  <div className="flex-1 py-3 rounded-2xl bg-gray-50 border-2 border-gray-200 text-center text-gray-400 font-bold text-sm cursor-not-allowed">📚 Learning</div>
                  <div className="flex-1 py-3 rounded-2xl bg-gray-50 border-2 border-gray-200 text-center text-gray-400 font-bold text-sm cursor-not-allowed">⚔️ Survival</div>
                </div>
              </div>
            </div>
          </div>

      </main>

      <LearnerBottomNav />
    </div>
  )
}
