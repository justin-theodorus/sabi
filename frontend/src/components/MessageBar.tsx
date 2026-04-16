'use client'

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
            <div
              key={`${icon.id}-${i}`}
              className="relative flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 pr-5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={icon.imageUrl}
                alt={icon.label}
                className="w-6 h-6 object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className="text-xs text-blue-800 font-medium">{icon.label}</span>
              <button
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-500 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors"
                title="Remove"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
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
