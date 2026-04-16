'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchHint } from '@/lib/dialogue'

interface SabiHintBarProps {
  scenarioId: string
  npcLastMessage: string | null
  visible: boolean
  availableIcons?: string[]
}

export default function SabiHintBar({ scenarioId, npcLastMessage, visible, availableIcons = [] }: SabiHintBarProps) {
  const [hint, setHint] = useState<string>('')
  const [loading, setLoading] = useState(false)
  // Use a ref so availableIcons can be read inside the effect without being a dep
  const availableIconsRef = useRef(availableIcons)
  availableIconsRef.current = availableIcons

  useEffect(() => {
    if (!visible || !npcLastMessage) return
    let cancelled = false

    // Delay hint by 4s so learner has a chance to respond first
    const timer = setTimeout(async () => {
      setLoading(true)
      const h = await fetchHint(scenarioId, npcLastMessage, availableIconsRef.current)
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
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      background: 'var(--yellow)', padding: '12px 16px',
      width: '100%', boxSizing: 'border-box',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot/sabi-mascot.png"
        alt="Sabi"
        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={(e) => {
          // Fallback: show a small circle with "S"
          const el = e.currentTarget as HTMLImageElement
          el.style.display = 'none'
          const fallback = el.nextSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,.15)', display: 'none', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: 800, color: '#7a5c00' }}>
        S
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#7a5c00', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sabi says</p>
        {loading ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '18px' }}>
            {[0, 150, 300].map((delay) => (
              <span key={delay} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7a5c00', opacity: 0.6, animation: `bounce 0.9s ${delay}ms infinite` }} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#7a5c00', lineHeight: 1.4 }}>
            {hint || 'Think about what you need to say…'}
          </p>
        )}
      </div>
    </div>
  )
}
