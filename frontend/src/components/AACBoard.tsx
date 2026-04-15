'use client'

import { useState } from 'react'

export interface AACIcon {
  id: string
  label: string
  category: 'core_words' | 'social' | 'emotions'
  imageUrl: string
}

// helper — every icon has a local path, no external requests
const cw = (id: string, ext = 'png'): string => `/icons/core_words/${id}.${ext}`
const sc = (id: string, ext = 'png'): string => `/icons/social/${id}.${ext}`
const em = (id: string, ext = 'png'): string => `/icons/emotions/${id}.${ext}`

const ICONS: AACIcon[] = [

  // ── Core Words ─ pronouns & questions ─────────────────────────────────────
  { id: 'i',           label: 'I',          category: 'core_words', imageUrl: cw('i') },
  { id: 'you',         label: 'you',        category: 'core_words', imageUrl: cw('you') },
  { id: 'we',          label: 'we',         category: 'core_words', imageUrl: cw('we') },
  { id: 'it',          label: 'it',         category: 'core_words', imageUrl: cw('it') },
  { id: 'what',        label: 'what',       category: 'core_words', imageUrl: cw('what', 'webp') },
  { id: 'where',       label: 'where',      category: 'core_words', imageUrl: cw('where', 'webp') },
  { id: 'yes',         label: 'yes',        category: 'core_words', imageUrl: cw('yes') },
  { id: 'not',         label: 'not',        category: 'core_words', imageUrl: cw('not', 'webp') },
  { id: 'dont',        label: "don't",      category: 'core_words', imageUrl: cw('dont', 'webp') },

  // ── Core Words ─ everyday verbs ───────────────────────────────────────────
  { id: 'want',        label: 'want',       category: 'core_words', imageUrl: cw('want') },
  { id: 'need',        label: 'need',       category: 'core_words', imageUrl: cw('need') },
  { id: 'like',        label: 'like',       category: 'core_words', imageUrl: cw('like') },
  { id: 'love',        label: 'love',       category: 'core_words', imageUrl: cw('love') },
  { id: 'help',        label: 'help',       category: 'core_words', imageUrl: cw('help') },
  { id: 'go',          label: 'go',         category: 'core_words', imageUrl: cw('go', 'webp') },
  { id: 'stop',        label: 'stop',       category: 'core_words', imageUrl: cw('stop') },
  { id: 'come',        label: 'come',       category: 'core_words', imageUrl: cw('come') },
  { id: 'eat',         label: 'eat',        category: 'core_words', imageUrl: cw('eat') },
  { id: 'drink',       label: 'drink',      category: 'core_words', imageUrl: cw('drink') },
  { id: 'play',        label: 'play',       category: 'core_words', imageUrl: cw('play') },
  { id: 'sleep',       label: 'sleep',      category: 'core_words', imageUrl: cw('sleep') },
  { id: 'sit',         label: 'sit',        category: 'core_words', imageUrl: cw('sit') },
  { id: 'stand',       label: 'stand',      category: 'core_words', imageUrl: cw('stand') },
  { id: 'walk',        label: 'walk',       category: 'core_words', imageUrl: cw('walk') },
  { id: 'run',         label: 'run',        category: 'core_words', imageUrl: cw('run') },
  { id: 'see',         label: 'see',        category: 'core_words', imageUrl: cw('see') },
  { id: 'listen',      label: 'listen',     category: 'core_words', imageUrl: cw('listen') },
  { id: 'say',         label: 'say',        category: 'core_words', imageUrl: cw('say') },
  { id: 'ask',         label: 'ask',        category: 'core_words', imageUrl: cw('ask') },
  { id: 'tell',        label: 'tell',       category: 'core_words', imageUrl: cw('tell') },
  { id: 'show',        label: 'show',       category: 'core_words', imageUrl: cw('show') },
  { id: 'take',        label: 'take',       category: 'core_words', imageUrl: cw('take') },
  { id: 'start',       label: 'start',      category: 'core_words', imageUrl: cw('start') },
  { id: 'finish',      label: 'finish',     category: 'core_words', imageUrl: cw('finish') },
  { id: 'choose',      label: 'choose',     category: 'core_words', imageUrl: cw('choose') },
  { id: 'wait',        label: 'wait',       category: 'core_words', imageUrl: cw('wait') },
  { id: 'try',         label: 'try',        category: 'core_words', imageUrl: cw('try') },
  { id: 'learn',       label: 'learn',      category: 'core_words', imageUrl: cw('learn') },
  { id: 'read',        label: 'read',       category: 'core_words', imageUrl: cw('read') },
  { id: 'write',       label: 'write',      category: 'core_words', imageUrl: cw('write') },
  { id: 'draw',        label: 'draw',       category: 'core_words', imageUrl: cw('draw') },
  { id: 'cook',        label: 'cook',       category: 'core_words', imageUrl: cw('cook') },
  { id: 'buy',         label: 'buy',        category: 'core_words', imageUrl: cw('buy') },
  { id: 'pay',         label: 'pay',        category: 'core_words', imageUrl: cw('pay') },
  { id: 'wash',        label: 'wash',       category: 'core_words', imageUrl: cw('wash') },
  { id: 'smile',       label: 'smile',      category: 'core_words', imageUrl: cw('smile') },
  { id: 'laugh',       label: 'laugh',      category: 'core_words', imageUrl: cw('laugh') },
  { id: 'hug',         label: 'hug',        category: 'core_words', imageUrl: cw('hug') },
  { id: 'wave',        label: 'wave',       category: 'core_words', imageUrl: cw('wave') },
  { id: 'share',       label: 'share',      category: 'core_words', imageUrl: cw('share') },
  { id: 'understand',  label: 'understand', category: 'core_words', imageUrl: cw('understand') },
  { id: 'think',       label: 'think',      category: 'core_words', imageUrl: cw('think') },
  { id: 'feel',        label: 'feel',       category: 'core_words', imageUrl: cw('feel') },
  { id: 'quick',       label: 'quick',      category: 'core_words', imageUrl: cw('quick', 'webp') },
  { id: 'slow',        label: 'slow',       category: 'core_words', imageUrl: cw('slow', 'webp') },
  { id: 'in',          label: 'in',         category: 'core_words', imageUrl: cw('in') },
  { id: 'on',          label: 'on',         category: 'core_words', imageUrl: cw('on') },
  { id: 'do',          label: 'do',         category: 'core_words', imageUrl: cw('do', 'webp') },

  // ── Social ─ greetings & phrases ──────────────────────────────────────────
  { id: 'hi',               label: 'hi',            category: 'social', imageUrl: sc('hi') },
  { id: 'bye',              label: 'bye',           category: 'social', imageUrl: sc('bye') },
  { id: 'thank-you',        label: 'thank you',     category: 'social', imageUrl: sc('thank-you') },
  { id: 'sorry',            label: 'sorry',         category: 'social', imageUrl: sc('sorry') },
  { id: 'ok',               label: 'ok',            category: 'social', imageUrl: sc('ok') },
  { id: 'good',             label: 'good',          category: 'social', imageUrl: sc('good') },
  { id: 'great',            label: 'great',         category: 'social', imageUrl: sc('great') },
  { id: 'help-me',          label: 'help me',       category: 'social', imageUrl: sc('help-me') },
  { id: 'how-are-you',      label: 'how are you',   category: 'social', imageUrl: sc('how-are-you') },
  { id: 'good-morning',     label: 'good morning',  category: 'social', imageUrl: sc('good-morning') },
  { id: 'see-you',          label: 'see you',       category: 'social', imageUrl: sc('see-you') },
  { id: 'nice-to-meet-you', label: 'nice to meet',  category: 'social', imageUrl: sc('nice-to-meet-you') },
  { id: 'dont-understand',  label: "don't understand", category: 'social', imageUrl: sc('dont-understand') },
  { id: 'understand-social', label: 'understand',   category: 'social', imageUrl: sc('understand') },
  { id: 'wait-social',      label: 'wait',          category: 'social', imageUrl: sc('wait') },

  // ── Social ─ connection concepts ──────────────────────────────────────────
  { id: 'friendship',   label: 'friendship', category: 'social', imageUrl: sc('friendship') },
  { id: 'kindness',     label: 'kindness',   category: 'social', imageUrl: sc('kindness') },
  { id: 'family',       label: 'family',     category: 'social', imageUrl: sc('family') },
  { id: 'friends',      label: 'friends',    category: 'social', imageUrl: sc('friends') },
  { id: 'fun',          label: 'fun',        category: 'social', imageUrl: sc('fun') },
  { id: 'games',        label: 'games',      category: 'social', imageUrl: sc('games') },
  { id: 'play-social',  label: 'play',       category: 'social', imageUrl: sc('play') },
  { id: 'celebration',  label: 'celebration',category: 'social', imageUrl: sc('celebration') },
  { id: 'party',        label: 'party',      category: 'social', imageUrl: sc('party') },
  { id: 'teamwork',     label: 'teamwork',   category: 'social', imageUrl: sc('teamwork') },
  { id: 'community',    label: 'community',  category: 'social', imageUrl: sc('community') },
  { id: 'respect',      label: 'respect',    category: 'social', imageUrl: sc('respect') },
  { id: 'smile-social', label: 'smile',      category: 'social', imageUrl: sc('smile') },
  { id: 'hug-social',   label: 'hug',        category: 'social', imageUrl: sc('hug') },
  { id: 'wave-social',  label: 'wave',       category: 'social', imageUrl: sc('wave') },
  { id: 'love-social',  label: 'love',       category: 'social', imageUrl: sc('love') },
  { id: 'laughter',     label: 'laughter',   category: 'social', imageUrl: sc('laughter') },
  { id: 'joy',          label: 'joy',        category: 'social', imageUrl: sc('joy') },
  { id: 'compliment',   label: 'compliment', category: 'social', imageUrl: sc('compliment') },
  { id: 'meeting',      label: 'meeting',    category: 'social', imageUrl: sc('meeting') },
  { id: 'activities',   label: 'activities', category: 'social', imageUrl: sc('activities') },
  { id: 'belonging',    label: 'belonging',  category: 'social', imageUrl: sc('belonging') },
  { id: 'gratitude',    label: 'gratitude',  category: 'social', imageUrl: sc('gratitude') },

  // ── Emotions ──────────────────────────────────────────────────────────────
  { id: 'happy',        label: 'happy',       category: 'emotions', imageUrl: em('happy') },
  { id: 'sad',          label: 'sad',         category: 'emotions', imageUrl: em('sad') },
  { id: 'angry',        label: 'angry',       category: 'emotions', imageUrl: em('angry', 'webp') },
  { id: 'scared',       label: 'scared',      category: 'emotions', imageUrl: em('scared', 'webp') },
  { id: 'excited',      label: 'excited',     category: 'emotions', imageUrl: em('excited', 'webp') },
  { id: 'surprised',    label: 'surprised',   category: 'emotions', imageUrl: em('surprised', 'webp') },
  { id: 'calm',         label: 'calm',        category: 'emotions', imageUrl: em('calm') },
  { id: 'confused',     label: 'confused',    category: 'emotions', imageUrl: em('confused') },
  { id: 'bored',        label: 'bored',       category: 'emotions', imageUrl: em('bored') },
  { id: 'anxious',      label: 'anxious',     category: 'emotions', imageUrl: em('anxious') },
  { id: 'proud',        label: 'proud',       category: 'emotions', imageUrl: em('proud', 'webp') },
  { id: 'relaxed',      label: 'relaxed',     category: 'emotions', imageUrl: em('relaxed') },
  { id: 'curious',      label: 'curious',     category: 'emotions', imageUrl: em('curious') },
  { id: 'content',      label: 'content',     category: 'emotions', imageUrl: em('content') },
  { id: 'motivated',    label: 'motivated',   category: 'emotions', imageUrl: em('motivated') },
  { id: 'joyful',       label: 'joyful',      category: 'emotions', imageUrl: em('joyful') },
  { id: 'playful',      label: 'playful',     category: 'emotions', imageUrl: em('playful') },
  { id: 'cheerful',     label: 'cheerful',    category: 'emotions', imageUrl: em('cheerful') },
  { id: 'shy',          label: 'shy',         category: 'emotions', imageUrl: em('shy') },
  { id: 'brave',        label: 'brave',       category: 'emotions', imageUrl: em('brave') },
  { id: 'determined',   label: 'determined',  category: 'emotions', imageUrl: em('determined', 'webp') },
  { id: 'silly',        label: 'silly',       category: 'emotions', imageUrl: em('silly') },
  { id: 'thoughtful',   label: 'thoughtful',  category: 'emotions', imageUrl: em('thoughtful') },
  { id: 'optimistic',   label: 'optimistic',  category: 'emotions', imageUrl: em('optimistic') },
  { id: 'peaceful',     label: 'peaceful',    category: 'emotions', imageUrl: em('peaceful') },
  { id: 'loving',       label: 'loving',      category: 'emotions', imageUrl: em('loving') },
  { id: 'loved',        label: 'loved',       category: 'emotions', imageUrl: em('loved') },
  { id: 'guilty',       label: 'guilty',      category: 'emotions', imageUrl: em('guilty') },
  { id: 'secure',       label: 'secure',      category: 'emotions', imageUrl: em('secure') },
  { id: 'inspired',     label: 'inspired',    category: 'emotions', imageUrl: em('inspired') },
  { id: 'satisfied',    label: 'satisfied',   category: 'emotions', imageUrl: em('satisfied') },
  { id: 'fulfilled',    label: 'fulfilled',   category: 'emotions', imageUrl: em('fulfilled') },
]

type Category = 'core_words' | 'social' | 'emotions'

interface CategoryMeta {
  label: string
  activeBg: string
  activeColor: string
  cellBg: string
  cellBorder: string
  labelColor: string
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
  core_words: {
    label: 'Core Words',
    activeBg: 'var(--yellow)',
    activeColor: '#111',
    cellBg: '#fffde7',
    cellBorder: '#f9d96e',
    labelColor: '#8a6100',
  },
  social: {
    label: 'Social',
    activeBg: 'var(--green)',
    activeColor: '#fff',
    cellBg: '#e6f4ea',
    cellBorder: '#a8d5b5',
    labelColor: '#1a6e35',
  },
  emotions: {
    label: 'Emotions',
    activeBg: 'var(--pink)',
    activeColor: '#fff',
    cellBg: '#ffeef1',
    cellBorder: '#ffb3bd',
    labelColor: '#c0394a',
  },
}

interface AACBoardProps {
  onIconSelect: (icon: AACIcon) => void
  selectedIds: string[]
}

export default function AACBoard({ onIconSelect, selectedIds }: AACBoardProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('core_words')
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const filtered = ICONS.filter((i) => i.category === activeCategory)
  const m = CATEGORY_META[activeCategory]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--font)' }}>
      {/* Category tabs */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
          const meta = CATEGORY_META[cat]
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                flex: 1,
                padding: '10px 8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                borderBottom: active ? `3px solid ${meta.activeBg}` : '3px solid transparent',
                background: active ? meta.activeBg : 'var(--surface-sub)',
                color: active ? meta.activeColor : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Icon grid — renders from ICONS array only, never hardcoded inline */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: '2px',
        padding: '8px',
        overflowY: 'auto',
        flex: 1,
        background: 'var(--surface-sub)',
      }}>
        {filtered.map((icon) => {
          const isSelected = selectedIds.includes(icon.id)
          const hasFailed = failedImages.has(icon.id)

          return (
            <button
              key={icon.id}
              onClick={() => onIconSelect(icon)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 4px 6px',
                borderRadius: '10px',
                border: isSelected ? `2px solid ${m.cellBorder}` : '2px solid transparent',
                background: isSelected ? m.cellBg : 'var(--surface)',
                cursor: 'pointer',
                minHeight: '80px',
                transition: 'background 0.12s, border-color 0.12s, transform 0.1s',
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,.1)' : 'none',
                fontFamily: 'var(--font)',
              }}
            >
              <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                {!hasFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={icon.imageUrl}
                    alt={icon.label}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={() => setFailedImages(prev => new Set(prev).add(icon.id))}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700 }}>
                    {icon.label.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                textAlign: 'center',
                lineHeight: 1.2,
                marginTop: '4px',
                color: isSelected ? m.labelColor : 'var(--text-secondary)',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {icon.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
