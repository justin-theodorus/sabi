'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { LearnerBottomNav } from '@/components/LearnerNav'
import CommunityIcon from '@/assets/CommunityHome.png'
import SchoolIcon from '@/assets/SchoolHome.png'
import HomeIcon from '@/assets/Homehome.png'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

// Scene → category mapping for icons
const SCENES = [
  {
    id: 'hawker_centre',
    title: 'Hawker Centre',
    subtitle: 'Order at a food stall',
    difficulty: 'Intermediate',
    category: 'Community',
    icon: CommunityIcon,
  },
  {
    id: 'group_project',
    title: 'Group Project',
    subtitle: 'Work with teammates',
    difficulty: 'Beginner',
    category: 'School',
    icon: SchoolIcon,
  },
  {
    id: 'queue_shop',
    title: 'Queue / Shop',
    subtitle: 'Buy something at a shop',
    difficulty: 'Beginner',
    category: 'Home',
    icon: HomeIcon,
  },
]

type Mode = 'learning' | 'survival'
type Scene = typeof SCENES[number]

function ModeModal({
  scene,
  onSelect,
  onClose,
}: {
  scene: Scene
  onSelect: (mode: Mode) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scene</p>
          <h3 className="text-gray-900 font-extrabold text-xl leading-tight mt-0.5">{scene.title}</h3>
          <p className="text-gray-400 text-sm mt-0.5">{scene.subtitle}</p>
        </div>

        <p className="text-gray-500 text-sm font-semibold mb-3">Choose your mode</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onSelect('learning')}
            className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all text-left active:scale-[0.98]"
          >
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">📚</div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-bold text-base">Learning Mode</p>
              <p className="text-gray-400 text-xs mt-0.5">Hints available · No timer · Low pressure</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('survival')}
            className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all text-left active:scale-[0.98]"
          >
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">⚔️</div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-bold text-base">Survival Mode</p>
              <p className="text-gray-400 text-xs mt-0.5">5 hearts · 30s timer · No hints</p>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full py-3 rounded-2xl text-gray-400 hover:text-gray-600 text-sm font-semibold transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function LearnerHomePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [authToken, setAuthToken]     = useState<string | null>(null)
  const [userName, setUserName]       = useState('Learner')
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [lastSession, setLastSession] = useState<{
    scenario_id: string; mode: string; status: string
  } | null>(null)

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
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setLastSession(data[0])
      })
      .catch(() => {})
  }, [authToken])

  function handleModeSelect(mode: Mode) {
    if (!selectedScene) return
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedMode', mode)
      sessionStorage.setItem('selectedScenario', selectedScene.id)
    }
    setSelectedScene(null)
    router.push('/learner/session')
  }

  function handleContinue() {
    if (!lastSession) {
      // Default to first scene
      sessionStorage.setItem('selectedMode', 'learning')
      sessionStorage.setItem('selectedScenario', 'hawker_centre')
    } else {
      sessionStorage.setItem('selectedMode', lastSession.mode)
      sessionStorage.setItem('selectedScenario', lastSession.scenario_id)
    }
    router.push('/learner/session')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-[#7DB2F6] text-xl font-bold">Loading…</div>
      </div>
    )
  }

  const heroScene = lastSession
    ? SCENES.find((s) => s.id === lastSession.scenario_id) ?? SCENES[0]
    : SCENES[0]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 pt-8 max-w-2xl mx-auto w-full">

        {/* Greeting */}
        <h1 className="text-2xl font-extrabold text-gray-900">Hi, {userName}!</h1>
        <p className="text-gray-400 text-sm mt-1">Let&apos;s practice today.</p>

        {/* Yellow hero card */}
        <div className="mt-5 bg-[#F5C842] rounded-2xl p-5">
          <span className="inline-block bg-black/20 text-[#5A4800] text-xs font-semibold px-3 py-1 rounded-full">
            {heroScene.difficulty}
          </span>
          <p className="text-gray-900 font-extrabold text-xl mt-2">{heroScene.title}</p>
          <p className="text-gray-700 text-sm mt-0.5">{heroScene.subtitle}</p>
          <button
            onClick={handleContinue}
            className="mt-4 w-full bg-white text-gray-900 font-bold text-sm py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors active:scale-[0.98]"
          >
            Continue this lesson <span>→</span>
          </button>
        </div>

        {/* Scene cards */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              onClick={() => setSelectedScene(scene)}
              className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 flex flex-col items-start text-left hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-shadow active:scale-[0.98]"
            >
              <div className="mb-3">
                <Image src={scene.icon} alt={scene.category} width={48} height={48} className="object-contain" />
              </div>
              <p className="font-extrabold text-gray-900 text-base leading-tight">{scene.category}</p>
              <p className="text-gray-400 text-xs mt-1 leading-snug">{scene.subtitle}</p>
              <div className="mt-3 w-full">
                <span className="inline-block w-full text-center bg-gray-100 text-gray-600 font-semibold text-sm py-2 rounded-full">
                  Start
                </span>
              </div>
            </button>
          ))}
        </div>
      </main>

      <LearnerBottomNav />

      {selectedScene && (
        <ModeModal
          scene={selectedScene}
          onSelect={handleModeSelect}
          onClose={() => setSelectedScene(null)}
        />
      )}
    </div>
  )
}
