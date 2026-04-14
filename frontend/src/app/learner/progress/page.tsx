'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnerHeader, LearnerBottomNav } from '@/components/LearnerNav'

const WEEKLY_DATA = [
  { day: 'Mon', sessions: 2 },
  { day: 'Tue', sessions: 1 },
  { day: 'Wed', sessions: 3 },
  { day: 'Thu', sessions: 0 },
  { day: 'Fri', sessions: 2 },
  { day: 'Sat', sessions: 4 },
  { day: 'Sun', sessions: 1 },
]

const ACHIEVEMENTS = [
  { id: 1, emoji: '🌟', title: 'First Step', desc: 'Completed your first session', earned: true },
  { id: 2, emoji: '🔥', title: '3-Day Streak', desc: 'Practised 3 days in a row', earned: true },
  { id: 3, emoji: '🍜', title: 'Hawker Pro', desc: 'Finished Hawker Centre 5 times', earned: false },
  { id: 4, emoji: '⚔️', title: 'Survivor', desc: 'Complete survival mode with 5 hearts', earned: false },
  { id: 5, emoji: '💬', title: 'Chatterbox', desc: 'Send 100 messages total', earned: false },
  { id: 6, emoji: '🏆', title: 'Master', desc: 'Complete all scenarios', earned: false },
]

const SCENARIO_PROGRESS = [
  { id: 'hawker_centre', emoji: '🍜', title: 'Hawker Centre', sessions: 5, pct: 72 },
  { id: 'group_project', emoji: '📚', title: 'Group Project', sessions: 2, pct: 35 },
  { id: 'queue_shop', emoji: '🛍️', title: 'Queue / Shop', sessions: 0, pct: 0 },
]

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

  const maxSessions = Math.max(...WEEKLY_DATA.map((d) => d.sessions), 1)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 md:px-8 pt-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Progress</h1>
        <p className="text-gray-400 text-sm mt-1">Keep going, {userName}!</p>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 space-y-5 pt-4">
          {/* XP + streak summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-gray-900">340</p>
              <p className="text-gray-400 text-xs mt-0.5">Total XP</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-gray-900">🔥 5</p>
              <p className="text-gray-400 text-xs mt-0.5">Day Streak</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-gray-900">13</p>
              <p className="text-gray-400 text-xs mt-0.5">Sessions</p>
            </div>
          </div>

          {/* Weekly activity bar chart */}
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-gray-900 font-extrabold text-base mb-4">This Week</p>
            <div className="flex items-end justify-between gap-2 h-24">
              {WEEKLY_DATA.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: '80px' }}>
                    <div
                      className="w-full rounded-t-xl transition-all duration-500"
                      style={{
                        height: `${(d.sessions / maxSessions) * 72}px`,
                        background: d.sessions > 0 ? '#E8714A' : '#F3F4F6',
                        minHeight: d.sessions > 0 ? '8px' : '4px',
                      }}
                    />
                  </div>
                  <p className="text-gray-400 text-xs font-semibold">{d.day}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario progress */}
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <p className="text-gray-900 font-extrabold text-base mb-4">Scenarios</p>
            <div className="space-y-4">
              {SCENARIO_PROGRESS.map((s) => (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{s.emoji}</span>
                      <span className="text-gray-800 font-semibold text-sm">{s.title}</span>
                    </div>
                    <span className="text-gray-400 text-xs">{s.sessions} sessions · {s.pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E8714A] rounded-full transition-all duration-700"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div>
            <h3 className="text-gray-900 text-xl font-extrabold mb-3">Achievements</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ACHIEVEMENTS.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-3xl p-4 shadow-sm flex flex-col gap-2 ${
                    a.earned ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                >
                  <span className="text-3xl">{a.emoji}</span>
                  <div>
                    <p className={`font-bold text-sm ${a.earned ? 'text-gray-900' : 'text-gray-500'}`}>
                      {a.title}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 leading-snug">{a.desc}</p>
                  </div>
                  {a.earned && (
                    <span className="self-start text-[10px] font-bold px-2 py-0.5 bg-[#FDE8DC] text-[#E8714A] rounded-full">
                      Earned ✓
                    </span>
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
