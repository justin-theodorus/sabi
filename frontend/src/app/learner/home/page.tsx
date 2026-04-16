'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchScenariosFromDB, SCENARIOS, type ScenarioConfig } from '@/lib/scenarios'
import { LearnerBottomNav } from '@/components/LearnerNav'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const SCENES = [
  {
    id: 'hawker_centre',
    title: 'Hawker Centre',
    subtitle: 'Order at a food stall',
    difficulty: 'Intermediate',
    category: 'Community',
  },
  {
    id: 'group_project',
    title: 'Group Project',
    subtitle: 'Work with teammates',
    difficulty: 'Beginner',
    category: 'School',
  },
  {
    id: 'queue_shop',
    title: 'Queue / Shop',
    subtitle: 'Buy something at a shop',
    difficulty: 'Beginner',
    category: 'Home',
  },
]

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

function diffBadgeClass(label: string): string {
  const l = label.toLowerCase()
  if (l === 'beginner' || l === 'easy') return 'badge-beginner'
  if (l === 'intermediate')             return 'badge-intermediate'
  if (l === 'hard' || l === 'difficult') return 'badge-hard'
  if (l === 'advanced')                 return 'badge-advanced'
  return 'badge-neutral'
}

function CategoryIcon({ category }: { category: string }) {
  if (category === 'Community') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="10" cy="10" r="4" stroke="var(--text-secondary)" strokeWidth="1.5" />
      <circle cx="20" cy="9" r="3" stroke="var(--text-secondary)" strokeWidth="1.3" opacity=".6" />
      <path d="M2 24c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 14c2.5 0 5 2 5 5.5" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
    </svg>
  )
  if (category === 'School') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="4" y="10" width="20" height="14" rx="2.5" stroke="var(--text-secondary)" strokeWidth="1.5" />
      <path d="M9 10V8.5a5 5 0 0110 0V10" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 16h20" stroke="var(--text-secondary)" strokeWidth="1.3" opacity=".4" />
      <circle cx="14" cy="19" r="1.5" fill="var(--text-secondary)" opacity=".6" />
    </svg>
  )
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M4 13.5L14 4l10 9.5V24a1 1 0 01-1 1H5a1 1 0 01-1-1v-10.5z" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 25v-8.5h8V25" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Mode = 'learning' | 'survival'

// SceneCard covers both static SCENES entries and DB-loaded custom ScenarioConfigs
type SceneCard = typeof SCENES[number] | (ScenarioConfig & { isCustom: true; subtitle: string; difficulty: string })

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '22px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 64px rgba(0,0,0,.18)', fontFamily: 'var(--font)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scene</p>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', letterSpacing: '-0.3px' }}>{scene.title}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{scene.subtitle}</p>
        </div>

        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Choose your mode</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => onSelect('learning')}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--surface-sub)', border: '1px solid var(--border)', borderRadius: '16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background 0.15s' }}>
            <div style={{ width: '44px', height: '44px', background: 'var(--surface)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="#3B82F6" strokeWidth="1.5" />
                <path d="M6 7h8M6 10h8M6 13h5" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Learning Mode</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Hints available · No timer · Low pressure</p>
            </div>
          </button>

          <button onClick={() => onSelect('survival')}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--surface-sub)', border: '1px solid var(--border)', borderRadius: '16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background 0.15s' }}>
            <div style={{ width: '44px', height: '44px', background: 'var(--surface)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12.5 7.5H18L13.5 10.9l1.8 5.6L10 13.3l-5.3 3.2 1.8-5.6L2 7.5h5.5L10 2z" stroke="#EF4444" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Survival Mode</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>5 hearts · 30s timer · No hints</p>
            </div>
          </button>
        </div>

        <button onClick={onClose} style={{ marginTop: '16px', width: '100%', padding: '12px', borderRadius: '16px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
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
  const [customScenes, setCustomScenes] = useState<ScenarioConfig[]>([])
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

  // Load therapist-created custom scenarios from DB
  useEffect(() => {
    fetchScenariosFromDB().then((all) => {
      const custom = Object.values(all).filter((config) => !!config.baseScenario)
      setCustomScenes(custom)
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
    const scenarioId = 'id' in selectedScene ? selectedScene.id : (selectedScene as ScenarioConfig).id
    const config = SCENARIOS[scenarioId] ?? null
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedMode', mode)
      sessionStorage.setItem('selectedScenario', scenarioId)
      if (config) sessionStorage.setItem('selectedScenarioConfig', JSON.stringify(config))
    }
    setSelectedScene(null)
    router.push('/learner/mood')
  }

  function handleContinue() {
    const scenarioId = lastSession?.scenario_id ?? SCENES[0].id
    const config = SCENARIOS[scenarioId] ?? SCENARIOS[SCENES[0].id]
    sessionStorage.setItem('selectedMode', lastSession?.mode ?? 'learning')
    sessionStorage.setItem('selectedScenario', scenarioId)
    if (config) sessionStorage.setItem('selectedScenarioConfig', JSON.stringify(config))
    router.push('/learner/mood')
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  const heroScene = lastSession
    ? SCENES.find((s) => s.id === lastSession.scenario_id) ?? SCENES[0]
    : SCENES[0]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 24px calc(var(--nav-h) + 32px)', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '768px', width: '100%', margin: '0 auto' }}>

        {/* Greeting */}
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Hi, {userName}!</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>Let&apos;s practice today.</p>

        {/* Hero card */}
        <div style={{ marginTop: '24px', background: 'var(--yellow)', borderRadius: '22px', padding: '24px' }}>
          <span className={diffBadgeClass(heroScene.difficulty)} style={{ marginBottom: '8px', display: 'inline-block' }}>
            {heroScene.difficulty}
          </span>
          <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginTop: '8px' }}>{heroScene.title}</p>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', opacity: 0.7, marginTop: '4px' }}>{heroScene.subtitle}</p>
          <button onClick={handleContinue}
            style={{ marginTop: '16px', width: '100%', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '99px', padding: '14px 24px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}>
            Continue this lesson
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Scene cards */}
        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {SCENES.map((scene) => (
            <button key={scene.id} onClick={() => setSelectedScene(scene)}
              style={{ background: 'var(--surface)', borderRadius: '22px', padding: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'box-shadow 0.2s' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <CategoryIcon category={scene.category} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>{scene.category}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>{scene.subtitle}</p>
              <div style={{ marginTop: '12px', width: '100%', textAlign: 'center', background: 'var(--surface-sub)', borderRadius: '99px', padding: '8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Start
              </div>
            </button>
          ))}
        </div>

        {/* Custom scenario cards (therapist-created) */}
        {customScenes.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>From your therapist</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customScenes.map((config) => {
                const baseCategory = SCENES.find((s) => s.id === (config.baseScenario ?? config.id))?.category ?? 'Community'
                const difficulty = config.supportLevel ? supportToDifficulty(config.supportLevel) : 'Intermediate'
                return (
                  <button
                    key={config.id}
                    onClick={() => setSelectedScene(config as SceneCard)}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font)' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CategoryIcon category={baseCategory} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{config.title}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.description}</p>
                    </div>
                    <span className={diffBadgeClass(difficulty)} style={{ flexShrink: 0 }}>{difficulty}</span>
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
