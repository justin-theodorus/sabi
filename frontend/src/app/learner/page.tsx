'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendDialogue, type Message } from '@/lib/dialogue'
import ScenarioStage from '@/components/ScenarioStage'
import AACBoard, { type AACIcon } from '@/components/AACBoard'
import MessageBar from '@/components/MessageBar'

export default function LearnerPage() {
  const router = useRouter()
  const [selectedIcons, setSelectedIcons] = useState<AACIcon[]>([])
  const [npcResponse, setNpcResponse] = useState<string | null>(
    'Hello! Welcome to my stall. What would you like today?'
  )
  const [npcLoading, setNpcLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
      } else {
        setAuthChecked(true)
      }
    })
  }, [router])

  function handleIconSelect(icon: AACIcon) {
    setSelectedIcons((prev) => [...prev, icon])
  }

  function handleRemoveIcon(index: number) {
    setSelectedIcons((prev) => prev.filter((_, i) => i !== index))
  }

  function handleClear() {
    setSelectedIcons([])
  }

  async function handleSubmit() {
    if (selectedIcons.length === 0 || npcLoading) return

    // Translate icons to natural language (Phase 1: simple join)
    const message = selectedIcons.map((i) => i.label).join(' ')

    // Optimistically clear icons
    setSelectedIcons([])
    setNpcLoading(true)
    setNpcResponse(null)

    try {
      const result = await sendDialogue(message, history)

      // Update conversation history
      const newHistory: Message[] = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: result.response },
      ]
      setHistory(newHistory)
      setNpcResponse(result.response)
    } catch (err) {
      console.error('Dialogue error:', err)
      setNpcResponse("Sorry, I didn't catch that. Could you try again?")
    } finally {
      setNpcLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading…</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">Hawker Centre</h1>
            <p className="text-gray-400 text-xs">Learning Mode</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main Content — landscape split */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Left: Scenario Stage */}
        <div className="w-[45%] flex-shrink-0">
          <ScenarioStage npcResponse={npcResponse} npcLoading={npcLoading} />
        </div>

        {/* Right: AAC Board + Message Bar */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <AACBoard
              onIconSelect={handleIconSelect}
              selectedIds={selectedIcons.map((i) => i.id)}
            />
          </div>
          <div className="flex-shrink-0">
            <MessageBar
              selectedIcons={selectedIcons}
              onRemove={handleRemoveIcon}
              onClear={handleClear}
              onSubmit={handleSubmit}
              loading={npcLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
