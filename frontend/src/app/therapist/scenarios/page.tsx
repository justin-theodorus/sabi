'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TherapistBottomNav } from '@/components/TherapistSidebar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

type Category = 'Home' | 'School' | 'Community'
const CATEGORIES: Category[] = ['Home', 'School', 'Community']

const BUILTIN_CATEGORY: Record<string, Category> = {
  'Hawker Centre': 'Community',
  'Group Project': 'School',
  'Queue / Shop':  'Home',
}

const BASE_TO_CATEGORY: Record<string, Category> = {
  hawker_centre: 'Community',
  group_project: 'School',
  queue_shop:    'Home',
}

/** Returns a badge CSS class per difficulty label */
function diffBadgeClass(label: string): string {
  const l = label.toLowerCase()
  if (l === 'beginner' || l === 'easy')       return 'badge-beginner'
  if (l === 'intermediate')                    return 'badge-intermediate'
  if (l === 'hard' || l === 'difficult')       return 'badge-hard'
  if (l === 'advanced')                        return 'badge-advanced'
  return 'badge-neutral'
}

const BUILTIN_DIFFICULTY: Record<string, string> = {
  'Hawker Centre': 'Intermediate',
  'Group Project': 'Beginner',
  'Queue / Shop':  'Beginner',
}

const SUPPORT_TO_DIFFICULTY: Record<string, string> = {
  High:        'Hard',
  Moderate:    'Intermediate',
  Low:         'Easy',
  Independent: 'Advanced',
}

interface DBScenario {
  id: string
  name: string
  description: string | null
  slug: string | null
  base_scenario: string | null
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
  if (sc.base_scenario) return BASE_TO_CATEGORY[sc.base_scenario] ?? 'Community'
  return BUILTIN_CATEGORY[sc.name] ?? 'Community'
}

function getDifficultyLabel(sc: DBScenario): string {
  if (!sc.created_by) return BUILTIN_DIFFICULTY[sc.name] ?? 'Intermediate'
  return SUPPORT_TO_DIFFICULTY[sc.support_level ?? 'Moderate'] ?? 'Intermediate'
}

let _cache: DBScenario[] | null = null

export default function ScenariosPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked]     = useState(false)
  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [therapistId, setTherapistId]     = useState<string | null>(null)
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

  function openNew() {
    setEditId(null); setForm({ ...BLANK }); setShowForm(true)
  }

  function openEdit(sc: DBScenario) {
    const cat = getCategory(sc)
    const modeAccess = sc.mode === 'survival' ? ['Survival Mode'] : sc.mode === 'both' ? ['Learning Mode', 'Survival Mode'] : ['Learning Mode']
    setEditId(sc.id)
    setForm({
      title: sc.name, description: sc.description ?? '', category: cat,
      supportLevel: sc.support_level ?? 'Moderate', modeAccess,
      hintLevel: sc.hint_level ?? 'Gentle nudge', npcPersonality: sc.npc_personality ?? 'Friendly',
      unpredictableEvents: sc.npc_path && ['Off','1 Twist','2+ Twist'].includes(sc.npc_path) ? sc.npc_path : 'Off',
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
      const savedSc: DBScenario = await res.json()
      setScenarios((prev) => {
        const updated = editId ? prev.map((s) => (s.id === editId ? savedSc : s)) : [...prev, savedSc]
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
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--blue)', fontSize: '18px', fontWeight: 700 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)' }}>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Library grid panel ── */}
        <div style={{ display: showForm ? undefined : 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-h) + 32px)' }}
          className={showForm ? 'hidden md:flex md:flex-col' : ''}>

          {/* Header */}
          <div style={{ padding: '28px 32px 0', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--surface-sub)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="6" width="16" height="12" rx="2.5" stroke="#555" strokeWidth="1.5" />
                <path d="M6 6V5a4 4 0 018 0v1" stroke="#555" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="10" cy="12" r="2" stroke="#555" strokeWidth="1.3" />
              </svg>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Scenario library</h1>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>Loading…</div>}

          {!loading && (
            <div style={{ padding: '0 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>

                {/* Create new card */}
                <button onClick={openNew}
                  style={{ background: 'var(--surface)', border: '2px dashed rgba(0,0,0,.12)', borderRadius: '22px', padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '12px', minHeight: '180px', transition: 'background 0.15s, border-color 0.15s', fontFamily: 'var(--font)' }}
                  className="hover:bg-[var(--surface-sub)] hover:border-gray-300">
                  <div style={{ width: '44px', height: '44px', background: '#111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.18s cubic-bezier(.34,1.56,.64,1)' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 4v10M4 9h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Create new scenario</div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Add a custom situation</div>
                </button>

                {/* Scenario cards */}
                {scenarios.map((sc) => {
                  const diffLabel = getDifficultyLabel(sc)
                  const cat       = getCategory(sc)
                  const isCustom  = !!sc.created_by
                  return (
                    <div key={sc.id}
                      style={{ background: 'var(--surface)', borderRadius: '22px', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0', transition: 'transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s' }}
                      className="hover:-translate-y-1 hover:shadow-card-md">

                      {/* Action row — edit + delete (equal visual weight) */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '12px' }}>
                        {/* Edit — ghost */}
                        <button
                          onClick={() => isCustom ? openEdit(sc) : undefined}
                          style={{
                            width: '32px', height: '32px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: isCustom ? 'pointer' : 'default',
                            opacity: isCustom ? 1 : 0.3,
                            transition: 'background 0.15s',
                            flexShrink: 0,
                          }}
                          className={isCustom ? 'hover:bg-[var(--surface-sub)]' : ''}
                          title="Edit"
                          disabled={!isCustom}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M9.5 2l2.5 2.5-7 7H2.5V9L9.5 2z" stroke="#555" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        {/* Delete — ghost, red tint on hover */}
                        {isCustom ? (
                          <button
                            onClick={() => handleDelete(sc)}
                            className="btn-ghost-delete"
                            title="Delete">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 3.5h10M5 3.5V2.5h4v1M4.5 3.5v8h5v-8" stroke="#c0394a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : (
                          <div style={{ width: '32px', height: '32px' }} />
                        )}
                      </div>

                      {/* Title + description */}
                      <div style={{ marginBottom: '16px', flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '4px' }}>{sc.name}</div>
                        {sc.description && (
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{sc.description}</div>
                        )}
                      </div>

                      {/* Difficulty + category badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span className={diffBadgeClass(diffLabel)}>{diffLabel}</span>
                        <span className="badge-neutral">{cat}</span>
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
          <div style={{ flex: 1, maxWidth: '480px', borderLeft: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)', paddingBottom: 'calc(var(--nav-h) + 32px)' }}>
            <div style={{ padding: '28px 32px', maxWidth: '480px' }}>
              <button
                onClick={() => { setShowForm(false); setForm(BLANK); setEditId(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '24px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'color 0.15s' }}
                className="hover:text-gray-800">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {editId ? 'Back' : 'New scenario'}
              </button>

              <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text-primary)', marginBottom: '24px' }}>
                {editId ? 'Edit scenario' : 'New scenario'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <FormField label="Title">
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Scenario name"
                    style={{ width: '100%', height: '44px', background: 'var(--surface-sub)', border: 'none', borderRadius: '14px', padding: '0 16px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', transition: 'background 0.15s' }} />
                </FormField>

                <FormField label="Description">
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the scenario" rows={2}
                    style={{ width: '100%', background: 'var(--surface-sub)', border: 'none', borderRadius: '14px', padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', outline: 'none', resize: 'none', fontFamily: 'var(--font)' }} />
                </FormField>

                <FormField label="Category">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                        style={{
                          padding: '8px 16px', borderRadius: '99px', fontSize: '13px', fontWeight: 600,
                          border: '1px solid',
                          borderColor: form.category === cat ? 'var(--blue)' : 'var(--border)',
                          background: form.category === cat ? 'var(--nav-active-bg)' : 'var(--surface)',
                          color: form.category === cat ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
                        }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label="Difficulty (support level)">
                  <Chips options={['High', 'Moderate', 'Low', 'Independent']}
                    selected={[form.supportLevel]}
                    onToggle={(v) => setForm({ ...form, supportLevel: v })} />
                </FormField>

                <FormField label="Mode access">
                  <Chips options={['Learning Mode', 'Survival Mode']}
                    selected={form.modeAccess}
                    multi onToggle={toggleMode} />
                </FormField>

                <FormField label="Hint level">
                  <Chips options={['No hints', 'Gentle nudge', 'Full guidance']}
                    selected={[form.hintLevel]}
                    onToggle={(v) => setForm({ ...form, hintLevel: v })} />
                </FormField>

                <FormField label="NPC personality">
                  <Chips options={['Friendly', 'Impatient', 'Confused']}
                    selected={[form.npcPersonality]}
                    onToggle={(v) => setForm({ ...form, npcPersonality: v })} />
                </FormField>

                <FormField label="Unpredictable events">
                  <Chips options={['Off', '1 Twist', '2+ Twist']}
                    selected={[form.unpredictableEvents]}
                    onToggle={(v) => setForm({ ...form, unpredictableEvents: v })} />
                </FormField>

                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  style={{ width: '100%', height: '52px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'opacity 0.15s', marginTop: '4px' }}
                  className="disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-88">
                  {saved ? 'Saved!' : saving ? 'Saving…' : editId ? 'Save changes' : 'Save to library'}
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
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Chips({ options, selected, onToggle, multi = false }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; multi?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map((v) => {
        const active = selected.includes(v)
        return (
          <button key={v} onClick={() => onToggle(v)}
            style={{
              padding: '8px 14px', borderRadius: '99px', fontSize: '13px', fontWeight: 600,
              border: '1px solid',
              borderColor: active ? 'var(--blue)' : 'var(--border)',
              background: active ? 'var(--nav-active-bg)' : 'var(--surface)',
              color: active ? 'var(--nav-active-text)' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.15s',
            }}>
            {v}
          </button>
        )
      })}
    </div>
  )
}
