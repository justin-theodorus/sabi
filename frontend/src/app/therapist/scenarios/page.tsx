'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

type Category = 'Home' | 'School' | 'Community'
const CATEGORIES: Category[] = ['Home', 'School', 'Community']

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  Home: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  School: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Community: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
}

const BUILTIN_CATEGORY: Record<string, Category> = {
  'Hawker Centre': 'Community',
  'Group Project':  'School',
  'Queue / Shop':   'Community',
}

const BUILTIN_DIFFICULTY: Record<string, { label: string; color: string }> = {
  'Hawker Centre': { label: 'Intermediate', color: 'bg-[#E8C840] text-[#6B5800]' },
  'Group Project':  { label: 'Beginner',    color: 'bg-[#80C870] text-[#2D5A20]' },
  'Queue / Shop':   { label: 'Beginner',    color: 'bg-[#80C870] text-[#2D5A20]' },
}

const SUPPORT_TO_DIFFICULTY: Record<string, { label: string; color: string }> = {
  High:        { label: 'Hard',         color: 'bg-[#E08080] text-white' },
  Moderate:    { label: 'Intermediate', color: 'bg-[#E8C840] text-[#6B5800]' },
  Low:         { label: 'Easy',         color: 'bg-[#80C870] text-[#2D5A20]' },
  Independent: { label: 'Advanced',     color: 'bg-[#8080E8] text-white' },
}

interface DBScenario {
  id: string
  name: string
  description: string | null
  slug: string | null
  mode: string
  npc_personality: string | null
  support_level: string | null
  hint_level: string | null
  npc_path: string | null
  created_by: string | null
  is_active: boolean
}

interface ScenarioForm {
  title: string
  description: string
  category: Category
  supportLevel: string
  modeAccess: string[]
  hintLevel: string
  npcPersonality: string
  unpredictableEvents: string
}

const BLANK: ScenarioForm = {
  title: '', description: '', category: 'Community',
  supportLevel: 'Moderate', modeAccess: ['Learning Mode'],
  hintLevel: 'Gentle nudge', npcPersonality: 'Friendly', unpredictableEvents: 'Off',
}

function getCategory(sc: DBScenario): Category {
  if (sc.created_by) {
    const s = sc.slug?.toLowerCase()
    if (s === 'home')   return 'Home'
    if (s === 'school') return 'School'
    return 'Community'
  }
  return BUILTIN_CATEGORY[sc.name] ?? 'Community'
}

function getDifficulty(sc: DBScenario) {
  if (!sc.created_by) return BUILTIN_DIFFICULTY[sc.name]
  return SUPPORT_TO_DIFFICULTY[sc.support_level ?? 'Moderate']
}

let _cache: DBScenario[] | null = null

export default function ScenariosPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked]     = useState(false)
  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [therapistId, setTherapistId]     = useState<string | null>(null)
  const [therapistName, setTherapistName] = useState('Therapist')
  const [scenarios, setScenarios]         = useState<DBScenario[]>(_cache ?? [])
  const [loading, setLoading]             = useState(!_cache)
  const [showForm, setShowForm]           = useState(false)
  const [editId, setEditId]               = useState<string | null>(null)
  const [form, setForm]                   = useState<ScenarioForm>(BLANK)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      const email = session.user.email ?? ''
      const n = email.split('@')[0]
      setTherapistName(n.charAt(0).toUpperCase() + n.slice(1))
      setTherapistId(session.user.id)
      setAuthToken(session.access_token)
      setAuthChecked(true)
    })
  }, [router])

  useEffect(() => {
    if (!authToken || _cache) return
    fetch(`${SESSION_URL}/scenarios`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data: DBScenario[]) => {
        _cache = Array.isArray(data) ? data : []
        setScenarios(_cache)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [authToken])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function openNew() {
    setEditId(null)
    setForm({ ...BLANK })
    setShowForm(true)
  }

  function openEdit(sc: DBScenario) {
    const cat = getCategory(sc)
    const modeAccess = sc.mode === 'survival' ? ['Survival Mode'] : sc.mode === 'both' ? ['Learning Mode', 'Survival Mode'] : ['Learning Mode']
    setEditId(sc.id)
    setForm({
      title: sc.name, description: sc.description ?? '', category: cat,
      supportLevel: sc.support_level ?? 'Moderate', modeAccess,
      hintLevel: sc.hint_level ?? 'Gentle nudge', npcPersonality: sc.npc_personality ?? 'Friendly',
      unpredictableEvents: sc.npc_path ?? 'Off',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !authToken) return
    setSaving(true)
    const body = {
      title: form.title, description: form.description, category: form.category,
      supportLevel: form.supportLevel, modeAccess: form.modeAccess,
      hintLevel: form.hintLevel, npcPersonality: form.npcPersonality,
      unpredictableEvents: form.unpredictableEvents,
    }
    const url    = editId ? `${SESSION_URL}/scenarios/${editId}` : `${SESSION_URL}/scenarios`
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const saved_sc: DBScenario = await res.json()
      setScenarios((prev) => {
        const updated = editId ? prev.map((s) => (s.id === editId ? saved_sc : s)) : [...prev, saved_sc]
        _cache = updated
        return updated
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowForm(false); setForm(BLANK); setEditId(null) }, 900)
  }

  async function handleDelete(sc: DBScenario) {
    if (!authToken) return
    const res = await fetch(`${SESSION_URL}/scenarios/${sc.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (res.ok) {
      setScenarios((prev) => {
        const updated = prev.filter((s) => s.id !== sc.id)
        _cache = updated
        return updated
      })
    }
  }

  function toggleMode(mode: string) {
    setForm((prev) => ({
      ...prev,
      modeAccess: prev.modeAccess.includes(mode)
        ? prev.modeAccess.filter((m) => m !== mode)
        : [...prev.modeAccess, mode],
    }))
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


      <div className="flex-1 flex overflow-hidden">

        {/* ── Library grid panel ── */}
        <div className={`${showForm ? 'hidden md:flex' : 'flex'} flex-col flex-1 overflow-y-auto pb-28`}>

          {/* Header */}
          <div className="px-6 lg:px-10 pt-8 pb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="4" rx="2" />
                <rect x="2" y="10" width="20" height="4" rx="2" />
                <rect x="2" y="17" width="20" height="4" rx="2" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">Scenario Library</h1>
          </div>

          {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

          {!loading && (
            <div className="px-6 lg:px-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

                {/* Create new card */}
                <button
                  onClick={openNew}
                  className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-6 text-left hover:border-gray-300 hover:shadow-[0_2px_16px_rgba(0,0,0,0.07)] transition-all active:scale-[0.98] flex flex-col gap-4"
                >
                  <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-extrabold text-2xl leading-snug">
                    Create new<br />scenario
                  </p>
                </button>

                {/* Scenario cards */}
                {scenarios.map((sc) => {
                  const diff = getDifficulty(sc)
                  const cat  = getCategory(sc)
                  const isCustom = !!sc.created_by
                  return (
                    <div key={sc.id} className="bg-white rounded-3xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.07)] relative flex flex-col gap-4 hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] transition-shadow">
                      {/* Top row: pencil + trash */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => isCustom ? openEdit(sc) : undefined}
                          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                            isCustom ? 'bg-gray-100 hover:bg-gray-200 cursor-pointer' : 'bg-gray-100 cursor-default opacity-30'
                          }`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {isCustom ? (
                          <button
                            onClick={() => handleDelete(sc)}
                            className="w-11 h-11 rounded-full bg-[#E07070] hover:bg-[#CC5555] flex items-center justify-center transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        ) : (
                          <div className="w-11 h-11" />
                        )}
                      </div>

                      {/* Title + description */}
                      <div>
                        <p className="font-extrabold text-gray-900 text-2xl leading-tight">{sc.name}</p>
                        {sc.description && (
                          <p className="text-gray-400 text-sm mt-1.5 line-clamp-2">{sc.description}</p>
                        )}
                      </div>

                      {/* Difficulty + category pills */}
                      <div className="flex flex-col gap-2">
                        {diff && (
                          <span className={`inline-flex items-center px-5 py-2.5 rounded-full text-[15px] font-semibold w-fit ${diff.color}`}>
                            {diff.label}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-100 text-gray-500 text-[14px] font-semibold w-fit">
                          {CATEGORY_ICON[cat]}
                          {cat}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Form panel ── */}
        {showForm && (
          <div className="flex-1 lg:max-w-xl lg:border-l lg:border-gray-100 overflow-y-auto bg-white pb-28">
            <div className="px-6 py-8 max-w-xl mx-auto">
              <button
                onClick={() => { setShowForm(false); setForm(BLANK); setEditId(null) }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm font-semibold mb-6 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                {editId ? 'Back' : 'New Scenario'}
              </button>

              <h2 className="text-xl font-extrabold text-gray-900 mb-6">
                {editId ? 'Edit Scenario' : 'New Scenario'}
              </h2>

              <div className="space-y-5">
                <FormField label="Title">
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Scenario Name"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#E8714A] bg-white" />
                </FormField>

                <FormField label="Description">
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the scenario" rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#E8714A] resize-none bg-white" />
                </FormField>

                <FormField label="Category">
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors
                          ${form.category === cat ? 'bg-[#E8714A] text-white border-[#E8714A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label="Difficulty (Support Level)">
                  <Chips options={['High', 'Moderate', 'Low', 'Independent']}
                    selected={[form.supportLevel]}
                    onToggle={(v) => setForm({ ...form, supportLevel: v })} />
                </FormField>

                <FormField label="Mode Access">
                  <Chips options={['Learning Mode', 'Survival Mode']}
                    selected={form.modeAccess}
                    multi onToggle={toggleMode} />
                </FormField>

                <FormField label="Hint Level">
                  <Chips options={['No hints', 'Gentle nudge', 'Full guidance']}
                    selected={[form.hintLevel]}
                    onToggle={(v) => setForm({ ...form, hintLevel: v })} />
                </FormField>

                <FormField label="NPC Personality">
                  <div className="flex gap-2 flex-wrap">
                    {['Friendly', 'Impatient', 'Confused'].map((v) => (
                      <button key={v} onClick={() => setForm({ ...form, npcPersonality: v })}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors
                          ${form.npcPersonality === v ? 'bg-[#E8714A] text-white border-[#E8714A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label="Unpredictable Events">
                  <Chips options={['Off', '1 Twist', '2+ Twist']}
                    selected={[form.unpredictableEvents]}
                    onToggle={(v) => setForm({ ...form, unpredictableEvents: v })} />
                </FormField>

                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="w-full py-3 bg-[#E8714A] hover:bg-[#d4613c] disabled:opacity-50 text-white font-bold rounded-2xl transition-colors text-sm mt-2">
                  {saved ? '✓ Saved!' : saving ? 'Saving…' : editId ? 'Save Changes' : 'Save to Library'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <TherapistBottomNav />
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function Chips({ options, selected, onToggle, multi = false }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; multi?: boolean
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((v) => (
        <button key={v} onClick={() => onToggle(v)}
          className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors
            ${selected.includes(v) ? 'bg-[#E8714A] text-white border-[#E8714A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
          {v}
        </button>
      ))}
    </div>
  )
}
