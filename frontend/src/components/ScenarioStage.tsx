'use client'

import { useState } from 'react'
import Image from 'next/image'
import SpeechBubble from './SpeechBubble'

interface ScenarioStageProps {
  npcResponse: string | null
  npcLoading: boolean
}

export default function ScenarioStage({ npcResponse, npcLoading }: ScenarioStageProps) {
  const [bgError, setBgError] = useState(false)
  const [npcError, setNpcError] = useState(false)

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      {/* z=1: Black fallback */}
      <div className="absolute inset-0 bg-black" style={{ zIndex: 1 }} />

      {/* z=2: Background photo */}
      {!bgError && (
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          <Image
            src="/backgrounds/hawker-centre.jpg"
            alt="Hawker Centre"
            fill
            className="object-cover"
            onError={() => setBgError(true)}
            priority
          />
        </div>
      )}

      {/* z=3: NPC photo — tall container anchored from top, feet clip off at stage bottom */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[75%]"
        style={{ zIndex: 3, top: '15%', height: '130%' }}
      >
        {!npcError && (
          <Image
            src="/npc/hawker-uncle.png"
            alt="Hawker Uncle"
            fill
            className="object-contain object-top"
            onError={() => setNpcError(true)}
          />
        )}
        {npcError && (
          <div className="flex justify-center pt-4">
            <div className="w-48 h-72 bg-gray-600 rounded-t-full opacity-60" />
          </div>
        )}
      </div>

      {/* z=4: Speech bubble */}
      <SpeechBubble text={npcResponse} loading={npcLoading} />
    </div>
  )
}
