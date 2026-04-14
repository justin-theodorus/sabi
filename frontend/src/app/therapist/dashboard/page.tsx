'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'

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
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

/** Mini week-calendar showing Mon–Sun of the current week */
function WeekCalendar() {
  const today = new Date()
  const day   = today.getDay() // 0=Sun, 1=Mon…
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const monthLabel = today.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-extrabold text-gray-900 text-base">{monthLabel}</p>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {LABELS.map((l) => (
          <span key={l} className="text-[10px] font-bold text-gray-400 pb-1">{l}</span>
        ))}
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString()
          return (
            <div key={i} className="flex flex-col items-center">
              <span
                className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                  isToday ? 'bg-gray-900 text-white' : 'text-gray-700'
                }`}
              >
                {d.getDate()}
              </span>
              {isToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-0.5" />
              )}
            </div>
          )
        })}
      </div>
      <button className="mt-2 text-xs font-semibold text-gray-400 hover:text-gray-600 w-full text-right transition-colors">
        See calendar →
      </button>
    </div>
  )
}

export default function TherapistDashboard() {
  const router = useRouter()
  const [authChecked, setAuthChecked]       = useState(false)
  const [authToken, setAuthToken]           = useState<string | null>(null)
  const [therapistName, setTherapistName]   = useState('Therapist')
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
      .then((data) => {
        if (data.recentSessions) setRecentSessions(data.recentSessions)
      })
      .catch(() => {})
  }, [authToken])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  const todaySessions = recentSessions.filter(
    (s) => new Date(s.started_at).toDateString() === new Date().toDateString()
  )
  const latestSessions = recentSessions.slice(0, 5)

  return (
    <div className="min-h-screen bg-white flex flex-col">

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row pb-16 pt-4">

        {/* ── Left main column ── */}
        <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5 space-y-5">

          {/* Search + bell row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                placeholder="Search"
                className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
              />
            </div>
            <button className="relative w-11 h-11 bg-white rounded-2xl shadow-sm flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
            </button>
          </div>

          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              {getGreeting()}, Dr. {therapistName}!
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">smgt {therapistName.toLowerCase()}</p>
          </div>

          {/* 3 action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* See my patients */}
            <Link href="/therapist/learners" className="group block bg-[#85B8E0] rounded-3xl p-5 relative overflow-hidden hover:opacity-95 transition-opacity">
              <div className="w-11 h-11 bg-white/30 rounded-full flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-white font-extrabold text-lg leading-tight">See my patients</p>
              <p className="text-white/80 text-xs mt-1">Click to manage patients</p>
              <div className="absolute bottom-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {/* See reports */}
            <Link href="/therapist/reports" className="group block bg-[#F5C842] rounded-3xl p-5 relative overflow-hidden hover:opacity-95 transition-opacity">
              <div className="w-11 h-11 bg-white/30 rounded-full flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" fill="white" />
                  <path d="M8 7h8M8 11h8M8 15h5" stroke="#F5C842" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="text-white font-extrabold text-lg leading-tight">See reports</p>
              <p className="text-white/80 text-xs mt-1">AI Summary from patients&apos; latest sessions</p>
              <div className="absolute bottom-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {/* Scenario Library */}
            <Link href="/therapist/scenarios" className="group block bg-[#F09090] rounded-3xl p-5 relative overflow-hidden hover:opacity-95 transition-opacity">
              <div className="w-11 h-11 bg-white/30 rounded-full flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="4" rx="2" fill="white" />
                  <rect x="2" y="10" width="20" height="4" rx="2" fill="white" />
                  <rect x="2" y="17" width="20" height="4" rx="2" fill="white" />
                </svg>
              </div>
              <p className="text-white font-extrabold text-lg leading-tight">Scenario Library</p>
              <p className="text-white/80 text-xs mt-1">See existing scenarios and create new ones.</p>
              <div className="absolute bottom-4 right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="md:w-72 lg:w-80 md:border-l md:border-gray-100 overflow-y-auto px-5 py-5 space-y-5 bg-white">

          {/* Dr. Name */}
          <div className="hidden md:flex items-center justify-end gap-2">
            <p className="text-sm font-bold text-gray-700">Dr. {therapistName}</p>
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
              {therapistName[0]}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white md:bg-transparent rounded-2xl p-0 md:p-0">
            <WeekCalendar />
          </div>

          {/* Today's Schedule */}
          <div>
            <p className="font-extrabold text-gray-900 text-sm mb-3">Today&apos;s Schedule</p>
            {todaySessions.length === 0 ? (
              <p className="text-gray-400 text-xs">No sessions today.</p>
            ) : (
              <div className="space-y-2.5">
                {todaySessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
                      {s.learner_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.learner_name}</p>
                      <p className="text-xs text-gray-400">{getScenarioName(s.scenario_id)}</p>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold flex-shrink-0">{formatTime(s.started_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Sessions */}
          <div>
            <p className="font-extrabold text-gray-900 text-sm mb-1">Latest Sessions</p>
            <p className="text-xs text-gray-400 mb-3">See all patients&apos; practice sessions.</p>
            {latestSessions.length === 0 ? (
              <p className="text-gray-400 text-xs">No sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {latestSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
                      {s.learner_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.learner_name}</p>
                      <p className="text-xs text-gray-400">{getScenarioName(s.scenario_id)}</p>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold flex-shrink-0">{formatTime(s.started_at)}</p>
                    {s.status === 'completed' && (
                      <Link href={`/therapist/sessions/${s.id}`}
                        className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-gray-700 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
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
