'use client'

import { useState } from 'react'
import Image from 'next/image'

export interface AACIcon {
  id: string
  label: string
  category: 'core_words' | 'social' | 'emotions'
}

const ICONS: AACIcon[] = [
  // Core Words
  { id: 'want', label: 'want', category: 'core_words' },
  { id: 'go', label: 'go', category: 'core_words' },
  { id: 'stop', label: 'stop', category: 'core_words' },
  { id: 'help', label: 'help', category: 'core_words' },
  { id: 'more', label: 'more', category: 'core_words' },
  { id: 'yes', label: 'yes', category: 'core_words' },
  { id: 'no', label: 'no', category: 'core_words' },
  { id: 'please', label: 'please', category: 'core_words' },
  { id: 'finished', label: 'finished', category: 'core_words' },
  { id: 'now', label: 'now', category: 'core_words' },
  { id: 'here', label: 'here', category: 'core_words' },
  { id: 'what', label: 'what', category: 'core_words' },
  { id: 'who', label: 'who', category: 'core_words' },
  { id: 'like', label: 'like', category: 'core_words' },
  { id: 'i', label: 'I', category: 'core_words' },
  { id: 'you', label: 'you', category: 'core_words' },
  // Social
  { id: 'hi', label: 'hi', category: 'social' },
  { id: 'bye', label: 'bye', category: 'social' },
  { id: 'thank-you', label: 'thank you', category: 'social' },
  { id: 'excuse-me', label: 'excuse me', category: 'social' },
  { id: 'sorry', label: 'sorry', category: 'social' },
  { id: 'good', label: 'good', category: 'social' },
  { id: 'great', label: 'great', category: 'social' },
  { id: 'ok', label: 'ok', category: 'social' },
  { id: 'wait', label: 'wait', category: 'social' },
  { id: 'understand', label: 'understand', category: 'social' },
  { id: 'see-you', label: 'see you', category: 'social' },
  { id: 'help-me', label: 'help me', category: 'social' },
  { id: 'nice-to-meet-you', label: 'nice to meet you', category: 'social' },
  { id: 'how-are-you', label: 'how are you', category: 'social' },
  { id: 'good-morning', label: 'good morning', category: 'social' },
  { id: 'dont-understand', label: "don't understand", category: 'social' },
  // Emotions
  { id: 'happy', label: 'happy', category: 'emotions' },
  { id: 'sad', label: 'sad', category: 'emotions' },
  { id: 'angry', label: 'angry', category: 'emotions' },
  { id: 'scared', label: 'scared', category: 'emotions' },
  { id: 'confused', label: 'confused', category: 'emotions' },
  { id: 'excited', label: 'excited', category: 'emotions' },
  { id: 'tired', label: 'tired', category: 'emotions' },
  { id: 'surprised', label: 'surprised', category: 'emotions' },
  { id: 'love', label: 'love', category: 'emotions' },
  { id: 'proud', label: 'proud', category: 'emotions' },
  { id: 'nervous', label: 'nervous', category: 'emotions' },
  { id: 'calm', label: 'calm', category: 'emotions' },
  { id: 'bored', label: 'bored', category: 'emotions' },
  { id: 'sick', label: 'sick', category: 'emotions' },
  { id: 'fine', label: 'fine', category: 'emotions' },
  { id: 'frustrated', label: 'frustrated', category: 'emotions' },
]

type Category = 'core_words' | 'social' | 'emotions'

const CATEGORY_META: Record<Category, { label: string; color: string; bg: string; border: string }> = {
  core_words: { label: 'Core Words', color: 'text-gray-900', bg: 'bg-white', border: 'border-gray-300' },
  social: { label: 'Social', color: 'text-white', bg: 'bg-green-600', border: 'border-green-500' },
  emotions: { label: 'Emotions', color: 'text-white', bg: 'bg-pink-600', border: 'border-pink-500' },
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
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex gap-2 mb-3 flex-shrink-0">
        {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
          const m = CATEGORY_META[cat]
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all border-2
                ${active
                  ? `${m.bg} ${m.color} ${m.border} shadow-md scale-105`
                  : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Icon Grid */}
      <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1">
        {filtered.map((icon) => {
          const isSelected = selectedIds.includes(icon.id)
          return (
            <button
              key={icon.id}
              onClick={() => onIconSelect(icon)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all active:scale-95
                ${isSelected
                  ? 'border-yellow-400 bg-yellow-50 shadow-md'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                }`}
            >
              <div className="w-12 h-12 relative mb-1">
                <Image
                  src={`/icons/${icon.category}/${icon.id}.png`}
                  alt={icon.label}
                  fill
                  className="object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                    setFailedImages(prev => new Set(prev).add(icon.id))
                  }}
                />
                {failedImages.has(icon.id) && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs font-bold pointer-events-none">
                    {icon.label.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'text-gray-900' : 'text-gray-300'}`}>
                {icon.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
