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
  { id: 'understand',       label: 'understand',    category: 'social', imageUrl: sc('understand') },
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

const CATEGORY_META: Record<Category, { label: string; tabColor: string; cellBg: string; cellBorder: string; labelColor: string; activeTab: string }> = {
  core_words: {
    label: 'Core Words',
    tabColor: 'bg-yellow-400 text-yellow-900 border-yellow-500',
    cellBg: 'bg-yellow-50 border-yellow-300',
    cellBorder: 'border-yellow-400',
    labelColor: 'text-yellow-900',
    activeTab: 'bg-yellow-400 text-yellow-900 border-yellow-500 shadow-md',
  },
  social: {
    label: 'Social',
    tabColor: 'bg-green-500 text-white border-green-600',
    cellBg: 'bg-green-50 border-green-300',
    cellBorder: 'border-green-400',
    labelColor: 'text-green-900',
    activeTab: 'bg-green-500 text-white border-green-600 shadow-md',
  },
  emotions: {
    label: 'Emotions',
    tabColor: 'bg-pink-500 text-white border-pink-600',
    cellBg: 'bg-pink-50 border-pink-300',
    cellBorder: 'border-pink-400',
    labelColor: 'text-pink-900',
    activeTab: 'bg-pink-500 text-white border-pink-600 shadow-md',
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
  const meta = CATEGORY_META[activeCategory]

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Category Tabs */}
      <div className="flex gap-0 flex-shrink-0 border-b border-gray-200">
        {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
          const m = CATEGORY_META[cat]
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 py-2.5 px-3 text-sm font-bold transition-all border-b-4
                ${active
                  ? `${m.activeTab} border-b-current`
                  : 'bg-gray-50 text-gray-500 border-b-transparent hover:bg-gray-100'
                }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Icon Grid */}
      <div className="grid grid-cols-3 gap-3 overflow-y-auto flex-1 p-3 bg-gray-50">
        {filtered.map((icon) => {
          const isSelected = selectedIds.includes(icon.id)
          const hasFailed = failedImages.has(icon.id)

          return (
            <button
              key={icon.id}
              onClick={() => onIconSelect(icon)}
              className={`flex flex-col items-center justify-between p-3 rounded-xl border-2 transition-all active:scale-95 min-h-[100px]
                ${isSelected
                  ? `${meta.cellBorder} ${meta.cellBg} ring-2 ring-offset-1 ring-current shadow-md scale-[1.02]`
                  : `border-gray-200 bg-white hover:${meta.cellBg} hover:border-gray-300 shadow-sm`
                }`}
            >
              <div className="w-14 h-14 relative flex-1 flex items-center justify-center">
                {!hasFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={icon.imageUrl}
                    alt={icon.label}
                    className="w-full h-full object-contain"
                    onError={() => setFailedImages(prev => new Set(prev).add(icon.id))}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg font-bold">
                    {icon.label.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className={`text-sm font-semibold text-center leading-tight mt-2 w-full
                ${isSelected ? meta.labelColor : 'text-gray-700'}`}>
                {icon.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
