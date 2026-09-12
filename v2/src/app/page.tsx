'use client'

import { useState } from 'react'
import AACBoard, { type AACIcon } from '@/components/AACBoard'

export default function Home() {
  const [selected, setSelected] = useState<AACIcon[]>([])

  const handleIconSelect = (icon: AACIcon) => {
    setSelected((prev) => [...prev, icon])
  }

  const clearSelection = () => setSelected([])

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <header
        style={{
          flexShrink: 0,
          padding: '14px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.2px' }}>SABI</h1>
        <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Hawker centre &middot; AAC board
        </p>
      </header>

      <section
        aria-label="Selected icons"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '64px',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flex: 1, overflowX: 'auto' }}>
          {selected.length === 0 ? (
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>
              Tap icons to build a message
            </span>
          ) : (
            selected.map((icon, i) => (
              <span
                key={`${icon.id}-${i}`}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--surface-sub)',
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {icon.label}
              </span>
            ))
          )}
        </div>
        <button
          onClick={clearSelection}
          disabled={selected.length === 0}
          style={{
            flexShrink: 0,
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border)',
            background: 'var(--surface-sub)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'var(--font)',
            cursor: selected.length === 0 ? 'default' : 'pointer',
            opacity: selected.length === 0 ? 0.4 : 1,
          }}
        >
          Clear
        </button>
      </section>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AACBoard onIconSelect={handleIconSelect} selectedIds={selected.map((i) => i.id)} />
      </div>
    </main>
  )
}
