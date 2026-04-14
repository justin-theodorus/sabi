'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewScenarioPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner') }
    })
  }, [router])

  async function handleSubmit(data: ScenarioFormData) {
    const slug = data.slug.trim() || data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    const { error } = await supabase.from('scenarios').insert({
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
      is_active: true,
    })

    if (error) throw new Error(error.message)
    router.push('/therapist/scenarios')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center gap-4">
        <Link href="/therapist/scenarios" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Scenarios
        </Link>
        <div className="w-px h-5 bg-gray-600" />
        <h1 className="text-lg font-bold">New Scenario</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <ScenarioForm onSubmit={handleSubmit} submitLabel="Create Scenario" />
      </main>
    </div>
  )
}
