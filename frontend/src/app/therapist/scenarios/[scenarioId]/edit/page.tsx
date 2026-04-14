'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ScenarioForm, { ScenarioFormData } from '@/components/ScenarioForm'

function parseIcons(raw: string): Array<{ id: string; label: string }> {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(label => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label }))
}

function iconsToString(icons: Array<{ label: string }> | null): string {
  if (!icons || !Array.isArray(icons)) return ''
  return icons.map(i => i.label).join(', ')
}

export default function EditScenarioPage() {
  const router = useRouter()
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const [initial, setInitial] = useState<Partial<ScenarioFormData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }

      const { data, error: err } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single()

      if (err || !data) {
        setError(err?.message ?? 'Scenario not found')
        setLoading(false)
        return
      }

      setInitial({
        name: data.name ?? '',
        description: data.description ?? '',
        slug: data.slug ?? '',
        npc_name: data.npc_name ?? '',
        npc_greeting: data.npc_greeting ?? '',
        npc_path: data.npc_path ?? '',
        npc_background_url: data.npc_background_url ?? '',
        npc_personality: data.npc_personality ?? 'Friendly',
        support_level: data.support_level ?? 'Moderate',
        hint_level: data.hint_level ?? 'Gentle nudge',
        mode: data.mode ?? 'learning',
        scenario_icons: iconsToString(data.scenario_icons),
      })
      setLoading(false)
    })
  }, [router, scenarioId])

  async function handleSubmit(data: ScenarioFormData) {
    const slug = data.slug.trim() || data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    const { error: err } = await supabase
      .from('scenarios')
      .update({
        name: data.name.trim(),
        description: data.description.trim() || null,
        slug,
        npc_name: data.npc_name.trim(),
        npc_greeting: data.npc_greeting.trim(),
        npc_path: data.npc_path.trim() || null,
        npc_background_url: data.npc_background_url.trim() || null,
        npc_personality: data.npc_personality,
        support_level: data.support_level,
        hint_level: data.hint_level,
        mode: data.mode,
        scenario_icons: parseIcons(data.scenario_icons),
      })
      .eq('id', scenarioId)

    if (err) throw new Error(err.message)
    router.push('/therapist/scenarios')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading…
      </div>
    )
  }

  if (error || !initial) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error ?? 'Scenario not found'}</p>
        <Link href="/therapist/scenarios" className="text-blue-400 hover:text-blue-300 text-sm">
          ← Back to Scenarios
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center gap-4">
        <Link href="/therapist/scenarios" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Scenarios
        </Link>
        <div className="w-px h-5 bg-gray-600" />
        <h1 className="text-lg font-bold">Edit Scenario</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <ScenarioForm initial={initial} onSubmit={handleSubmit} submitLabel="Save Changes" />
      </main>
    </div>
  )
}
