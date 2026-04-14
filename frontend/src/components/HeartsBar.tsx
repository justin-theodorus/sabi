'use client'

import Image from 'next/image'
import livesImg from '@/assets/Lives.png'

interface HeartsBarProps {
  hearts: number
  maxHearts?: number
}

export default function HeartsBar({ hearts, maxHearts = 5 }: HeartsBarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-red-900/40 border border-red-700/50 rounded-lg">
      <span className="text-xs text-red-300 font-medium mr-1">Lives</span>
      {Array.from({ length: maxHearts }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-300 ${
            i < hearts ? 'opacity-100' : 'opacity-20 grayscale'
          }`}
          aria-label={i < hearts ? 'life' : 'lost life'}
        >
          <Image src={livesImg} alt="life" width={22} height={22} className="object-contain" />
        </div>
      ))}
    </div>
  )
}
