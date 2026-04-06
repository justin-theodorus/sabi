'use client'

import Image from 'next/image'
import type { AACIcon } from './AACBoard'

interface MessageBarProps {
  selectedIcons: AACIcon[]
  onRemove: (index: number) => void
  onClear: () => void
  onSubmit: () => void
  loading: boolean
}

export default function MessageBar({
  selectedIcons,
  onRemove,
  onClear,
  onSubmit,
  loading,
}: MessageBarProps) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border-2 border-gray-200 shadow-sm">
      {/* Selected icons as chips */}
      <div className="flex-1 flex flex-wrap gap-2 min-h-[3rem] items-center">
        {selectedIcons.length === 0 ? (
          <span className="text-gray-400 text-sm italic">Select icons above to build your message…</span>
        ) : (
          selectedIcons.map((icon, i) => (
            <button
              key={`${icon.id}-${i}`}
              onClick={() => onRemove(i)}
              className="flex items-center gap-1 bg-blue-50 hover:bg-red-50 border border-blue-200 hover:border-red-300 rounded-lg px-2 py-1 transition-colors group"
              title="Click to remove"
            >
              <div className="w-6 h-6 relative flex-shrink-0">
                <Image
                  src={`/icons/${icon.category}/${icon.id}.png`}
                  alt={icon.label}
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xs text-blue-800 group-hover:text-red-700 font-medium">{icon.label}</span>
            </button>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-shrink-0">
        {selectedIcons.length > 0 && (
          <button
            onClick={onClear}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            title="Clear"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={selectedIcons.length === 0 || loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors shadow-sm"
          title="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Send
        </button>
      </div>
    </div>
  )
}
