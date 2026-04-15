'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { fetchScenariosFromDB, type ScenarioConfig } from '@/lib/scenarios'
import { LearnerBottomNav } from '@/components/LearnerNav'
import CommunityIcon from '@/assets/CommunityHome.png'
import SchoolIcon from '@/assets/SchoolHome.png'
import HomeIcon from '@/assets/Homehome.png'
import type { StaticImageData } from 'next/image'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

// Maps base scenario id → display metadata used on the home page cards
const BASE_META: Record<string, { category: string; subtitle: string; difficulty: string; icon: StaticImageData }> = {
  hawker_centre: { category: 'Community', subtitle: 'Order at a food stall',     difficulty: 'Intermediate', icon: CommunityIcon },
  group_project: { category: 'School',    subtitle: 'Work with teammates',        difficulty: 'Beginner',     icon: SchoolIcon },
  queue_shop:    { category: 'Home',      subtitle: 'Buy something at a shop',    difficulty: 'Beginner',     icon: HomeIcon },
}

// Derives a difficulty label from the support_level therapist field
function supportToDifficulty(level?: string): string {
  switch (level) {
    case 'High':        return 'Beginner'
    case 'Moderate':    return 'Intermediate'
    case 'Low':         return 'Advanced'
    case 'Independent': return 'Expert'
    default:            return 'Intermediate'
  }
}

type Mode = 'learning' | 'survival'

interface SceneCard {
  config: ScenarioConfig
  category: string
  subtitle: string
  difficulty: string
  icon: StaticImageData
  isCustom: boolean
}

function ModeModal({
  scene,
  onSelect,
  onClose,
}: {
  scene: SceneCard
  onSelect: (mode: Mode) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scene</p>
          <h3 className="text-gray-900 font-extrabold text-xl leading-tight mt-0.5">{scene.config.title}</h3>
          <p className="text-gray-400 text-sm mt-0.5">{scene.config.description || scene.subtitle}</p>
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
  const [selectedScene, setSelectedScene] = useState<SceneCard | null>(null)
  const [scenes, setScenes] = useState<SceneCard[]>([])
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
    fetchScenariosFromDB().then((all) => {
      const cards: SceneCard[] = Object.values(all).map((config) => {
        const baseKey = config.baseScenario ?? config.id
        const meta = BASE_META[baseKey] ?? BASE_META.hawker_centre
        return {
          config,
          category: meta.category,
          subtitle: meta.subtitle,
          difficulty: config.supportLevel ? supportToDifficulty(config.supportLevel) : meta.difficulty,
          icon: meta.icon,
          isCustom: !!config.baseScenario,
        }
      })
      setScenes(cards)
    })
  }, [])

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
      sessionStorage.setItem('selectedScenario', selectedScene.config.id)
      sessionStorage.setItem('selectedScenarioConfig', JSON.stringify(selectedScene.config))
    }
    setSelectedScene(null)
    router.push('/learner/session')
  }

  function handleContinue() {
    const heroScene = lastSession
      ? scenes.find((s) => s.config.id === lastSession.scenario_id) ?? scenes[0]
      : scenes[0]
    if (!heroScene) return
    sessionStorage.setItem('selectedMode', lastSession?.mode ?? 'learning')
    sessionStorage.setItem('selectedScenario', heroScene.config.id)
    sessionStorage.setItem('selectedScenarioConfig', JSON.stringify(heroScene.config))
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
    ? scenes.find((s) => s.config.id === lastSession.scenario_id) ?? scenes[0]
    : scenes[0]

  const baseScenes    = scenes.filter((s) => !s.isCustom)
  const customScenes  = scenes.filter((s) => s.isCustom)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 overflow-y-auto pb-28 px-5 md:px-8 pt-8 max-w-2xl mx-auto w-full">

        {/* Greeting */}
        <h1 className="text-2xl font-extrabold text-gray-900">Hi, {userName}!</h1>
        <p className="text-gray-400 text-sm mt-1">Let&apos;s practice today.</p>

        {/* Yellow hero card */}
        {heroScene && (
          <div className="mt-5 bg-[#F5C842] rounded-2xl p-5">
            <span className="inline-block bg-black/20 text-[#5A4800] text-xs font-semibold px-3 py-1 rounded-full">
              {heroScene.difficulty}
            </span>
            <p className="text-gray-900 font-extrabold text-xl mt-2">{heroScene.config.title}</p>
            <p className="text-gray-700 text-sm mt-0.5">{heroScene.config.description || heroScene.subtitle}</p>
            <button
              onClick={handleContinue}
              className="mt-4 w-full bg-white text-gray-900 font-bold text-sm py-3.5 rounded-full flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors active:scale-[0.98]"
            >
              Continue this lesson <span>→</span>
            </button>
          </div>
        )}

        {/* Base scenario cards */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {baseScenes.map((scene) => (
            <button
              key={scene.config.id}
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

        {/* Custom scenario cards (therapist-created) */}
        {customScenes.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">From your therapist</p>
            <div className="flex flex-col gap-3">
              {customScenes.map((scene) => {
                const baseMeta = BASE_META[scene.config.baseScenario ?? 'hawker_centre'] ?? BASE_META.hawker_centre
                return (
                  <button
                    key={scene.config.id}
                    onClick={() => setSelectedScene(scene)}
                    className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 text-left hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-shadow active:scale-[0.98]"
                  >
                    <div className="flex-shrink-0">
                      <Image src={baseMeta.icon} alt={baseMeta.category} width={40} height={40} className="object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-tight">{scene.config.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{scene.config.description || baseMeta.subtitle}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{scene.difficulty}</span>
                      <span className="text-[10px] text-gray-400">{baseMeta.category}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
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
