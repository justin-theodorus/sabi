'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-[#E8714A] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">


      <div className="px-5 md:px-8 pt-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Your account settings</p>
      </div>

      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 pt-4 space-y-4 max-w-lg mx-auto w-full">

        {/* Avatar + name */}
        <div className="bg-white rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="w-20 h-20 rounded-3xl bg-[#FDE8DC] flex items-center justify-center text-[#E8714A] font-extrabold text-2xl flex-shrink-0">
            {therapistName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-gray-900 text-xl font-extrabold">Dr. {therapistName}</h2>
            <p className="text-gray-400 text-sm mt-0.5 truncate">{email}</p>
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#E8714A] bg-[#FDE8DC] px-2.5 py-1 rounded-full">
              Therapist
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-gray-900 font-bold">Settings</p>
          </div>
          {[
            { icon: '🔔', label: 'Notifications', value: 'On' },
            { icon: '🌐', label: 'Language', value: 'English' },
            { icon: '🔒', label: 'Privacy', value: 'Manage' },
          ].map((s, i, arr) => (
            <div key={s.label} className={`flex items-center justify-between px-5 py-4 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{s.icon}</span>
                <span className="text-gray-800 font-semibold text-sm">{s.label}</span>
              </div>
              <span className="text-gray-400 text-sm">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-4 bg-white rounded-3xl shadow-sm text-rose-500 font-bold hover:bg-rose-50 transition-colors"
        >
          Sign Out
        </button>

        <p className="text-center text-gray-300 text-xs pb-2">SABI · AAC Communication Training · v0.1</p>
      </main>

      <TherapistBottomNav />
    </div>
  )
}
