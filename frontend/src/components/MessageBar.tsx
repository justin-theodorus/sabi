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
    <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
      {/* Selected icons as chips */}
      <div className="flex-1 flex flex-wrap gap-2 min-h-[3rem] items-center">
        {selectedIcons.length === 0 ? (
          <span className="text-gray-500 text-sm italic">Select icons above to build your message…</span>
        ) : (
          selectedIcons.map((icon, i) => (
            <button
              key={`${icon.id}-${i}`}
              onClick={() => onRemove(i)}
              className="flex items-center gap-1 bg-gray-700 hover:bg-red-800 border border-gray-600 rounded-lg px-2 py-1 transition-colors group"
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
              <span className="text-xs text-gray-300 group-hover:text-white">{icon.label}</span>
            </button>
          ))
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-shrink-0">
        {selectedIcons.length > 0 && (
          <button
            onClick={onClear}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
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
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
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
