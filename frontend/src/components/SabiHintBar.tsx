'use client'

import { useEffect, useState } from 'react'
import { fetchHint } from '@/lib/dialogue'

interface SabiHintBarProps {
  scenarioId: string
  npcLastMessage: string | null
  visible: boolean
}

export default function SabiHintBar({ scenarioId, npcLastMessage, visible }: SabiHintBarProps) {
  const [hint, setHint] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible || !npcLastMessage) return
    let cancelled = false

    // Delay hint by 4s so learner has a chance to respond first
    const timer = setTimeout(async () => {
      setLoading(true)
      const h = await fetchHint(scenarioId, npcLastMessage)
      if (!cancelled) {
        setHint(h)
        setLoading(false)
      }
    }, 4000)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setHint('')
    }
  }, [npcLastMessage, visible, scenarioId])

  if (!visible) return null

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-yellow-400/15 border border-yellow-500/40 rounded-lg">
      <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-yellow-900 font-bold text-xs">S</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-yellow-700 text-xs font-semibold mb-0.5">Sabi says:</p>
        {loading ? (
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" />
          </div>
        ) : (
          <p className="text-yellow-900 text-sm leading-snug">{hint || 'Think about what you need to say…'}</p>
        )}
      </div>
    </div>
  )
}
