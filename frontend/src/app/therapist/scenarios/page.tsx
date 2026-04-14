'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SCENARIOS } from '@/lib/scenarios'

interface DBScenario {
  id: string
  name: string
  slug: string | null
  description: string | null
  npc_name: string | null
  npc_personality: string | null
  support_level: string | null
  mode: string
  is_active: boolean | null
  created_at: string
}

export default function ScenariosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dbScenarios, setDbScenarios] = useState<DBScenario[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      if (session.user.user_metadata?.role !== 'therapist') { router.push('/learner'); return }
      fetchScenarios()
    })
  }, [router])

  async function fetchScenarios() {
    const { data, error: err } = await supabase
      .from('scenarios')
      .select('id, name, slug, description, npc_name, npc_personality, support_level, mode, is_active, created_at')
      .order('created_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }
    setDbScenarios((data ?? []) as DBScenario[])
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean | null) {
    await supabase.from('scenarios').update({ is_active: !current }).eq('id', id)
    setDbScenarios(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  const builtinScenarios = Object.values(SCENARIOS)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/therapist/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Dashboard
          </Link>
          <div className="w-px h-5 bg-gray-600" />
          <h1 className="text-lg font-bold">Scenarios</h1>
        </div>
        <Link
          href="/therapist/scenarios/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          + New Scenario
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Built-in scenarios (read-only) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Built-in Scenarios
          </h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
            {builtinScenarios.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white text-sm">{s.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>
                </div>
                <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">Built-in</span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom scenarios */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Custom Scenarios ({dbScenarios.length})
          </h2>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
              {error}
            </div>
          )}

          {dbScenarios.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-3xl mb-3">🎭</div>
              <p className="text-sm">No custom scenarios yet.</p>
              <p className="text-xs mt-1">Create one to customise the NPC, icons, and difficulty for your learner.</p>
              <Link
                href="/therapist/scenarios/new"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                + New Scenario
              </Link>
            </div>
          )}

          {dbScenarios.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {dbScenarios.map(s => (
                <div key={s.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{s.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <span>{s.npc_name ?? 'No NPC set'}</span>
                      {s.npc_personality && <span>· {s.npc_personality}</span>}
                      {s.support_level && <span>· {s.support_level} support</span>}
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                        s.mode === 'survival'
                          ? 'bg-rose-900/50 text-rose-300'
                          : 'bg-green-900/50 text-green-300'
                      }`}>
                        {s.mode === 'survival' ? '💀 Survival' : '📚 Learning'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(s.id, s.is_active)}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                        s.is_active !== false
                          ? 'border-green-600 text-green-400 bg-green-900/20'
                          : 'border-gray-600 text-gray-500'
                      }`}
                    >
                      {s.is_active !== false ? 'Active' : 'Inactive'}
                    </button>
                    <Link
                      href={`/therapist/scenarios/${s.id}/edit`}
                      className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded border border-gray-600 transition-colors"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
