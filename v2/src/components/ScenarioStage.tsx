'use client'

import Image from 'next/image'

import type { NpcEmotion } from '@/lib/prompt/types'
import type { ScenarioConfig } from '@/lib/scenario/hawker-centre'

interface Props {
  readonly scenario: ScenarioConfig
  readonly npcEmotion: NpcEmotion
  readonly reply: string
  readonly isStreaming: boolean
  readonly eventLine: string | null
}

/**
 * The scene: background, NPC sprite, speech bubble.
 *
 * The sprite is chosen by npcEmotion, whose six values match the six files in /npc/uncle exactly.
 * In v1 this was effectively frozen on confused.png, because the keyword classifier feeding it
 * returns "confused" for any reply containing a question mark and the NPC is instructed to ask
 * one question per turn (finding 2.9). Phase 2 replaces the classifier; the sprite wiring is
 * already correct and will start working the moment it does.
 */
export default function ScenarioStage({ scenario, npcEmotion, reply, isStreaming, eventLine }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--surface-sub)',
      }}
    >
      <Image
        src={scenario.background}
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: 'cover' }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 38%)',
        }}
      />

      {eventLine ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'min(92%, 520px)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill, 999px)',
            background: 'var(--yellow)',
            color: '#3b2f00',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,.18)',
          }}
        >
          {eventLine}
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 10,
          padding: '16px 16px 18px',
        }}
      >
        <SpeechBubble name={scenario.npcName} text={reply} isStreaming={isStreaming} />

        <div style={{ position: 'relative', width: 'min(46vw, 210px)', aspectRatio: '1 / 1', maxWidth: '100%' }}>
          <Image
            key={npcEmotion}
            src={`${scenario.npcSpritePath}/${npcEmotion}.png`}
            alt={`${scenario.npcName}, looking ${npcEmotion}`}
            fill
            sizes="(max-width: 480px) 46vw, 210px"
            style={{ objectFit: 'contain' }}
          />
        </div>
      </div>
    </div>
  )
}

function SpeechBubble({ name, text, isStreaming }: { name: string; text: string; isStreaming: boolean }) {
  const empty = text.length === 0

  return (
    <div
      aria-live="polite"
      style={{
        width: 'min(100%, 560px)',
        minHeight: 62,
        padding: '11px 14px',
        borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 3px 14px rgba(0,0,0,.14)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.4px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {name}
      </div>
      <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-primary)' }}>
        {empty && isStreaming ? <Thinking /> : text}
      </p>
    </div>
  )
}

function Thinking() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 20 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: 'pulse 1.1s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  )
}
