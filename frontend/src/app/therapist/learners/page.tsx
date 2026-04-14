'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TherapistHeader, TherapistBottomNav } from '@/components/TherapistSidebar'
import { CommunicationRadar } from '@/components/CommunicationRadar'

const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

const PERSONA_INFO: Record<string, { label: string; emoji: string; bg: string; text: string; desc: string; focus: string }> = {
  garang_crab:             { label: 'Garang Crab',   emoji: '🦀', bg: 'bg-rose-50',    text: 'text-rose-700',    desc: 'Confident communicator, high initiation, may rush responses.',   focus: 'Strategic competency.' },
  shy_chick:               { label: 'Shy Chick',     emoji: '🐣', bg: 'bg-yellow-50',  text: 'text-yellow-700',  desc: 'Hesitant communicator, high latency, frequent re-prompts.',       focus: 'Confidence building.' },
  zippy_sotong:            { label: 'Zippy Sotong',  emoji: '🦑', bg: 'bg-purple-50',  text: 'text-purple-700',  desc: 'Very energetic but lacks structure, rushes interactions.',         focus: 'Linguistic structure.' },
  curious_monkey:          { label: 'Curious Monkey',emoji: '🐒', bg: 'bg-orange-50',  text: 'text-orange-700',  desc: 'Exploratory and playful, tries varied communication patterns.',    focus: 'Operational fluency.' },
  steady_turtle:           { label: 'Steady Turtle', emoji: '🐢', bg: 'bg-green-50',   text: 'text-green-700',   desc: 'Reflective and calm, thoughtful moderate-pace engagement.',        focus: 'Social engagement.' },
  guided_learner:          { label: 'Guided Learner',emoji: '🧭', bg: 'bg-blue-50',    text: 'text-blue-700',    desc: 'Thrives with hints and step-by-step support.',                     focus: 'Confidence building.' },
  social_practice_learner: { label: 'Social Learner',emoji: '🤝', bg: 'bg-purple-50',  text: 'text-purple-700',  desc: 'Loves interactive conversations and social practice.',             focus: 'Social competency.' },
  independent_communicator:{ label: 'Independent',   emoji: '🚀', bg: 'bg-emerald-50', text: 'text-emerald-700', desc: 'Works best independently, tackles challenges head-on.',            focus: 'Strategic competency.' },
}

const BUILTIN_CATEGORY: Record<string, string> = {
  'Hawker Centre': 'Community',
  'Group Project':  'School',
  'Queue / Shop':   'Community',
}
const BUILTIN_DIFFICULTY: Record<string, { label: string; color: string }> = {
  'Hawker Centre': { label: 'Intermediate', color: 'bg-yellow-100 text-yellow-700' },
  'Group Project':  { label: 'Beginner',     color: 'bg-green-100 text-green-700' },
  'Queue / Shop':   { label: 'Beginner',     color: 'bg-green-100 text-green-700' },
}

interface Learner {
  id: string
  name: string
  email: string
  persona?: string
}

interface LearnerDetail {
  id: string
  name: string
  persona: string | null
  competence_avg: {
    operational: number; linguistic: number; social: number
    strategic: number; confidence: number; sessionCount: number
  } | null
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

type Tab = 'Home' | 'School' | 'Community'

interface NewScenario {
  title: string
  description: string
  category: Tab
  supportLevel: string
  modeAccess: string[]
  hintLevel: string
  npcPersonality: string
  unpredictableEvents: string
}

const BLANK: NewScenario = {
  title: '', description: '', category: 'Community',
  supportLevel: 'Moderate', modeAccess: ['Learning Mode'],
  hintLevel: 'Gentle nudge', npcPersonality: 'Friendly', unpredictableEvents: 'Off',
}

const CATEGORY_EMOJI: Record<Tab, string> = { Home: '🏠', School: '🏫', Community: '🌏' }

function getScenarioCategory(sc: DBScenario): string {
  if (sc.created_by) {
    const s = sc.slug?.toLowerCase()
    if (s === 'home') return 'Home'
    if (s === 'school') return 'School'
    return 'Community'
  }
  return BUILTIN_CATEGORY[sc.name] ?? 'Community'
}

let _scenariosCache: DBScenario[] | null = null

export default function LearnersPage() {
  const router = useRouter()
  const [therapistName, setTherapistName] = useState('Therapist')
  const [authToken, setAuthToken]         = useState<string | null>(null)
  const [learners, setLearners]           = useState<Learner[]>([])
  const [scenarios, setScenarios]         = useState<DBScenario[]>(_scenariosCache ?? [])
  const [selected, setSelected]           = useState<Learner | null>(null)
  const [learnerDetail, setLearnerDetail] = useState<LearnerDetail | null>(null)
  const [tab, setTab]                     = useState<Tab>('Community')
  const [showForm, setShowForm]           = useState(false)
  const [form, setForm]                   = useState<NewScenario>(BLANK)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      const role = session.user.user_metadata?.role
      if (role !== 'therapist') { router.push('/learner'); return }
      const email = session.user.email ?? ''
      const n = email.split('@')[0]
      setTherapistName(n.charAt(0).toUpperCase() + n.slice(1))
      setAuthToken(session.access_token)
    })
  }, [router])

  useEffect(() => {
    if (!authToken) return
    fetch(`${SESSION_URL}/learners`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data: Learner[]) => {
        setLearners(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) setSelected(data[0])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    if (_scenariosCache) return
    fetch(`${SESSION_URL}/scenarios`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data: DBScenario[]) => {
        _scenariosCache = Array.isArray(data) ? data : []
        setScenarios(_scenariosCache)
      })
      .catch(() => {})
  }, [authToken])

  // Fetch detailed competence data for the selected learner
  useEffect(() => {
    if (!authToken || !selected) return
    setLearnerDetail(null)
    fetch(`${SESSION_URL}/learners/${selected.id}`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((data: LearnerDetail) => setLearnerDetail(data))
      .catch(() => {})
  }, [authToken, selected])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function toggleMode(mode: string) {
    setForm((prev) => ({
      ...prev,
      modeAccess: prev.modeAccess.includes(mode)
        ? prev.modeAccess.filter((m) => m !== mode)
        : [...prev.modeAccess, mode],
    }))
  }

  async function handleSave() {
    if (!form.title.trim() || !authToken) return
    setSaving(true)
    const res = await fetch(`${SESSION_URL}/scenarios`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title, description: form.description, category: form.category,
        supportLevel: form.supportLevel, modeAccess: form.modeAccess, hintLevel: form.hintLevel,
        npcPersonality: form.npcPersonality, unpredictableEvents: form.unpredictableEvents,
      }),
    })
    if (res.ok) {
      const newSc: DBScenario = await res.json()
      const updated = [...((_scenariosCache) ?? []), newSc]
      _scenariosCache = updated
      setScenarios(updated)
      setTab(form.category)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowForm(false); setForm(BLANK) }, 900)
  }

  const scenariosForTab = scenarios.filter((sc) => getScenarioCategory(sc) === tab)
  const personaInfo = PERSONA_INFO[selected?.persona ?? '']

  const radarScores = learnerDetail?.competence_avg ? [
    { dimension: 'Operational', value: learnerDetail.competence_avg.operational },
    { dimension: 'Linguistic',  value: learnerDetail.competence_avg.linguistic },
    { dimension: 'Social',      value: learnerDetail.competence_avg.social },
    { dimension: 'Strategic',   value: learnerDetail.competence_avg.strategic },
    { dimension: 'Confidence',  value: learnerDetail.competence_avg.confidence },
  ] : null

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex flex-1 overflow-hidden">

      {/* ── Left panel: learner list ── */}
      <div className="w-56 md:w-64 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="px-5 pt-6 pb-3">
          <h1 className="text-xl font-extrabold text-gray-900">Learners</h1>
          <p className="text-gray-400 text-xs mt-0.5">{learners.length} enrolled</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading && <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>}
          {!loading && learners.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No learners yet.</div>
          )}
          {learners.map((l) => {
            const pi = PERSONA_INFO[l.persona ?? '']
            const isSelected = selected?.id === l.id
            return (
              <button key={l.id} onClick={() => { setSelected(l); setShowForm(false) }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl mb-1 text-left transition-colors
                  ${isSelected ? 'bg-[#FDE8DC]' : 'hover:bg-gray-50'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0
                  ${isSelected ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                  style={isSelected ? { background: 'var(--color-primary)' } : {}}>
                  {l.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${isSelected ? 'text-[#E8714A]' : 'text-gray-800'}`}>{l.name}</p>
                  {pi && <p className="text-xs text-gray-400 truncate">{pi.emoji} {pi.label}</p>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
        {!selected && !loading && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a learner to view their profile.
          </div>
        )}

        {selected && !showForm && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0"
                  style={{ background: 'var(--color-primary)' }}>
                  {selected.name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">{selected.name}</h2>
                  {personaInfo && <p className="text-xs text-gray-400">{personaInfo.emoji} {personaInfo.label}</p>}
                </div>
              </div>
              <Link href={`/therapist/reports/${selected.id}`}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                Full Report →
              </Link>
            </div>

            {/* Persona card */}
            {personaInfo && (
              <div className={`${personaInfo.bg} rounded-2xl p-4 flex items-start gap-3`}>
                <span className="text-2xl">{personaInfo.emoji}</span>
                <div>
                  <p className={`font-bold text-sm ${personaInfo.text}`}>{personaInfo.label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{personaInfo.desc} Focus: {personaInfo.focus}</p>
                </div>
              </div>
            )}

            {/* ── Communication Competence Pentagon ── */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-extrabold text-gray-900 text-base">Communication Competence</h3>
                <Link href={`/therapist/reports/${selected.id}`}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--color-primary)' }}>
                  See details →
                </Link>
              </div>
              {learnerDetail?.competence_avg && (
                <p className="text-xs text-gray-400 mb-4">
                  Avg across {learnerDetail.competence_avg.sessionCount} scored session{learnerDetail.competence_avg.sessionCount !== 1 ? 's' : ''}
                </p>
              )}

              {!learnerDetail ? (
                <div className="text-center py-6 text-gray-300 text-sm">Loading…</div>
              ) : !radarScores ? (
                <div className="text-center py-6 text-gray-300 text-sm">No scored sessions yet.</div>
              ) : (
                <CommunicationRadar scores={radarScores} size={240} />
              )}
            </div>

            {/* Category tabs */}
            <div>
              <h3 className="text-gray-900 font-extrabold text-base mb-3">Practice Set</h3>
              <div className="flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
                {(['Home', 'School', 'Community'] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold transition-colors
                      ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {CATEGORY_EMOJI[t]} {t}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {scenariosForTab.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-6">No scenarios in {tab} yet.</p>
                )}
                {scenariosForTab.map((sc) => {
                  const diff = BUILTIN_DIFFICULTY[sc.name]
                  const isCustom = !!sc.created_by
                  return (
                    <button key={sc.id}
                      onClick={() => router.push(`/therapist/reports/${selected.id}`)}
                      className="w-full bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow text-left">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{sc.name}</p>
                        {sc.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{sc.description}</p>
                        )}
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {diff && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${diff.color}`}>
                              {diff.label}
                            </span>
                          )}
                          {isCustom && sc.support_level && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              {sc.support_level}
                            </span>
                          )}
                          {isCustom && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              sc.mode === 'survival' ? 'bg-rose-100 text-rose-600' : 'bg-green-100 text-green-700'
                            }`}>
                              {sc.mode === 'survival' ? 'Survival' : 'Learning'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 ml-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  )
                })}

                <button onClick={() => { setForm({ ...BLANK, category: tab }); setShowForm(true) }}
                  className="w-full bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors border-2 border-dashed border-gray-200">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--color-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Custom new scenario</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── New Scenario inline form ── */}
        {selected && showForm && (
          <div className="max-w-xl mx-auto px-6 py-8">
            <button onClick={() => { setShowForm(false); setForm(BLANK) }}
              className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm font-semibold mb-6 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <h2 className="text-xl font-extrabold text-gray-900 mb-6">New Scenario</h2>
            <div className="space-y-5">
              <Field label="Title">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Scenario Name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#E8714A] bg-white" />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the scenario" rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#E8714A] resize-none bg-white" />
              </Field>
              <Field label="Category">
                <div className="flex gap-2 flex-wrap">
                  {(['Home', 'School', 'Community'] as Tab[]).map((cat) => (
                    <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors
                        ${form.category === cat ? 'text-white border-[#E8714A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                      style={form.category === cat ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}>
                      {CATEGORY_EMOJI[cat]} {cat}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Support Level">
                <Chips options={['High', 'Moderate', 'Low', 'Independent']}
                  selected={[form.supportLevel]}
                  onToggle={(v) => setForm({ ...form, supportLevel: v })} />
              </Field>
              <Field label="Mode Access">
                <Chips options={['Learning Mode', 'Survival Mode']}
                  selected={form.modeAccess} multi onToggle={toggleMode} />
              </Field>
              <Field label="Hint Level">
                <Chips options={['No hints', 'Gentle nudge', 'Full guidance']}
                  selected={[form.hintLevel]}
                  onToggle={(v) => setForm({ ...form, hintLevel: v })} />
              </Field>
              <Field label="NPC Personality">
                <div className="flex gap-2 flex-wrap">
                  {['Friendly', 'Impatient', 'Confused'].map((v) => (
                    <button key={v} onClick={() => setForm({ ...form, npcPersonality: v })}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors
                        ${form.npcPersonality === v ? 'text-white border-[#E8714A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                      style={form.npcPersonality === v ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}>
                      {v}
                    </button>
                  ))}
                  <button onClick={() => setForm({ ...form, npcPersonality: 'Custom' })}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors
                      ${form.npcPersonality === 'Custom' ? 'text-white border-[#E8714A]' : 'bg-white border-[#E8714A] hover:bg-[#FDE8DC]'}`}
                    style={form.npcPersonality === 'Custom'
                      ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'white' }
                      : { color: 'var(--color-primary)' }}>
                    Customize +
                  </button>
                </div>
              </Field>
              <Field label="Unpredictable Events">
                <Chips options={['Off', '1 Twist', '2+ Twist']}
                  selected={[form.unpredictableEvents]}
                  onToggle={(v) => setForm({ ...form, unpredictableEvents: v })} />
              </Field>

              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="w-full py-3 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors text-sm mt-2"
                style={{ background: 'var(--color-primary)' }}>
                {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save & Add to Library'}
              </button>
            </div>
          </div>
        )}
      </div>

      </div>{/* end flex row */}

      <TherapistBottomNav />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
            ${selected.includes(v) ? 'text-white border-[#E8714A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          style={selected.includes(v) ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}>
          {v}
        </button>
      ))}
    </div>
  )
}
