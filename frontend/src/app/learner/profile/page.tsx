'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnerHeader, LearnerBottomNav } from '@/components/LearnerNav'

const PERSONA_INFO: Record<string, { label: string; emoji: string; desc: string; color: string }> = {
  guided_learner: {
    label: 'Guided Learner',
    emoji: '🧭',
    desc: 'You thrive with hints and step-by-step support. Keep building confidence!',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  social_practice_learner: {
    label: 'Social Practice Learner',
    emoji: '🤝',
    desc: 'You love interactive conversations and learning through social practice.',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  independent_communicator: {
    label: 'Independent Communicator',
    emoji: '🚀',
    desc: 'You work best independently and tackle challenges head-on.',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

export default function ProfilePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState('Learner')
  const [email, setEmail] = useState('')
  const [persona, setPersona] = useState<string>('guided_learner')
  const [userId, setUserId] = useState<string | null>(null)

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
      setUserId(session.user.id)

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  const personaInfo = PERSONA_INFO[persona] ?? PERSONA_INFO.guided_learner
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 md:px-8 pt-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Your account and settings</p>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 space-y-5 pt-4">
          {/* Avatar + name card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-[#FDE8DC] flex items-center justify-center text-[#E8714A] font-extrabold text-2xl flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-gray-900 text-xl font-extrabold">{userName}</h2>
              <p className="text-gray-400 text-sm mt-0.5 truncate">{email}</p>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#E8714A] bg-[#FDE8DC] px-2.5 py-1 rounded-full">
                <span>🐟</span> Curious Clownfish
              </div>
            </div>
          </div>

          {/* Persona card */}
          <div className={`rounded-3xl p-5 shadow-sm border-2 ${personaInfo.color} bg-white`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{personaInfo.emoji}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Communication Style</p>
                <p className="text-gray-900 font-extrabold text-base">{personaInfo.label}</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm leading-snug">{personaInfo.desc}</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-gray-900">340</p>
              <p className="text-gray-400 text-xs mt-0.5">XP</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-gray-900">13</p>
              <p className="text-gray-400 text-xs mt-0.5">Sessions</p>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-gray-900">🔥5</p>
              <p className="text-gray-400 text-xs mt-0.5">Streak</p>
            </div>
          </div>

          {/* Settings list */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-gray-900 font-bold">Settings</p>
            </div>
            {[
              { icon: '🔔', label: 'Notifications', value: 'On' },
              { icon: '🎵', label: 'NPC Audio', value: 'On' },
              { icon: '📷', label: 'Webcam', value: 'On' },
              { icon: '🌐', label: 'Language', value: 'English' },
            ].map((s, i, arr) => (
              <div
                key={s.label}
                className={`flex items-center justify-between px-5 py-4 ${
                  i < arr.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-gray-800 font-semibold text-sm">{s.label}</span>
                </div>
                <span className="text-gray-400 text-sm">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            className="w-full py-4 bg-white rounded-3xl shadow-sm text-rose-500 font-bold hover:bg-rose-50 transition-colors"
          >
            Sign Out
          </button>

          <p className="text-center text-gray-300 text-xs pb-2">
            SABI · AAC Communication Training · v0.1
          </p>
      </main>

      <LearnerBottomNav />
    </div>
  )
}
