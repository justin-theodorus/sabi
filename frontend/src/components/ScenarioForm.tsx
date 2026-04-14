'use client'

import { useState } from 'react'

export interface ScenarioFormData {
  name: string
  description: string
  slug: string
  npc_name: string
  npc_greeting: string
  npc_path: string
  npc_background_url: string
  npc_personality: string
  support_level: string
  hint_level: string
  mode: string
  scenario_icons: string  // comma-separated "label:id" pairs, e.g. "eat:eat,drink:drink"
}

interface Props {
  initial?: Partial<ScenarioFormData>
  onSubmit: (data: ScenarioFormData) => Promise<void>
  submitLabel?: string
}

const FIELD_CLASS =
  'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

const SELECT_CLASS =
  'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

export default function ScenarioForm({ initial = {}, onSubmit, submitLabel = 'Save Scenario' }: Props) {
  const [form, setForm] = useState<ScenarioFormData>({
    name: initial.name ?? '',
    description: initial.description ?? '',
    slug: initial.slug ?? '',
    npc_name: initial.npc_name ?? '',
    npc_greeting: initial.npc_greeting ?? '',
    npc_path: initial.npc_path ?? '',
    npc_background_url: initial.npc_background_url ?? '',
    npc_personality: initial.npc_personality ?? 'Friendly',
    support_level: initial.support_level ?? 'Moderate',
    hint_level: initial.hint_level ?? 'Gentle nudge',
    mode: initial.mode ?? 'learning',
    scenario_icons: initial.scenario_icons ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  function update(field: keyof ScenarioFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!form.name.trim()) { setFieldError('Title is required.'); return }
    if (!form.npc_name.trim()) { setFieldError('NPC Name is required.'); return }
    if (!form.npc_greeting.trim()) { setFieldError('NPC Greeting is required.'); return }

    setSaving(true)
    try {
      await onSubmit(form)
    } catch (err: unknown) {
      setFieldError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fieldError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {fieldError}
        </div>
      )}

      {/* Basic info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-200">Scenario Info</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              placeholder="e.g. Hawker Centre"
              value={form.name}
              onChange={update('name')}
              className={FIELD_CLASS}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slug (URL key)</label>
            <input
              type="text"
              placeholder="e.g. hawker_centre"
              value={form.slug}
              onChange={update('slug')}
              className={FIELD_CLASS}
            />
            <p className="text-[10px] text-gray-500 mt-1">Lowercase, underscores. Leave blank to auto-generate.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <textarea
            rows={2}
            placeholder="Brief description of the social scenario"
            value={form.description}
            onChange={update('description')}
            className={FIELD_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Default Mode</label>
            <select value={form.mode} onChange={update('mode')} className={SELECT_CLASS}>
              <option value="learning">📚 Learning</option>
              <option value="survival">💀 Survival</option>
            </select>
          </div>
        </div>
      </div>

      {/* NPC */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-200">NPC Character</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">NPC Name *</label>
            <input
              type="text"
              placeholder="e.g. Uncle Beng"
              value={form.npc_name}
              onChange={update('npc_name')}
              className={FIELD_CLASS}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">NPC Personality</label>
            <select value={form.npc_personality} onChange={update('npc_personality')} className={SELECT_CLASS}>
              <option value="Friendly">Friendly — warm and patient</option>
              <option value="Impatient">Impatient — hurried, short replies</option>
              <option value="Confused">Confused — asks for clarification often</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">NPC Opening Greeting *</label>
          <textarea
            rows={2}
            placeholder="e.g. Hello! Welcome to my stall. What would you like today?"
            value={form.npc_greeting}
            onChange={update('npc_greeting')}
            className={FIELD_CLASS}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">NPC Image Path</label>
            <input
              type="text"
              placeholder="/npc/hawker-uncle.png"
              value={form.npc_path}
              onChange={update('npc_path')}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Background Image Path</label>
            <input
              type="text"
              placeholder="/backgrounds/hawker-centre.jpg"
              value={form.npc_background_url}
              onChange={update('npc_background_url')}
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Session settings */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-200">Session Settings</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Support Level</label>
            <select value={form.support_level} onChange={update('support_level')} className={SELECT_CLASS}>
              <option value="High">High — very simple language, lots of patience</option>
              <option value="Moderate">Moderate — balanced complexity</option>
              <option value="Low">Low — natural pace with some complexity</option>
              <option value="Independent">Independent — fully natural conversation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hint Level (Learning Mode)</label>
            <select value={form.hint_level} onChange={update('hint_level')} className={SELECT_CLASS}>
              <option value="No hints">No hints</option>
              <option value="Gentle nudge">Gentle nudge</option>
              <option value="Full guidance">Full guidance</option>
            </select>
          </div>
        </div>
      </div>

      {/* AAC icons */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-200">Scenario-Specific Icons</h2>
        <p className="text-xs text-gray-400">
          Enter icon labels separated by commas. These are shown as extra icons on the AAC board for this scenario.
          Core/Social/Emotion icons are always available.
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Icon Labels (comma-separated)</label>
          <input
            type="text"
            placeholder="chicken rice, noodle, drink, takeaway, how much"
            value={form.scenario_icons}
            onChange={update('scenario_icons')}
            className={FIELD_CLASS}
          />
          <p className="text-[10px] text-gray-500 mt-1">
            Example: &quot;chicken rice, noodle, drink&quot; → icons will be looked up by label.
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
