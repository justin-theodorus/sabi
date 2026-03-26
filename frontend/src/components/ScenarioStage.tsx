import Image from 'next/image'
import SpeechBubble from './SpeechBubble'

interface ScenarioStageProps {
  npcResponse: string | null
  npcLoading: boolean
}

export default function ScenarioStage({ npcResponse, npcLoading }: ScenarioStageProps) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      {/* z=1: Black fallback */}
      <div className="absolute inset-0 bg-black" style={{ zIndex: 1 }} />

      {/* z=2: Background photo */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        <Image
          src="/backgrounds/hawker-centre.jpg"
          alt="Hawker Centre"
          fill
          className="object-cover"
          onError={(e) => {
            // Hide if image missing
            (e.target as HTMLElement).style.display = 'none'
          }}
          priority
        />
      </div>

      {/* z=3: NPC photo */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-64"
        style={{ zIndex: 3 }}
      >
        <Image
          src="/npc/hawker-uncle.png"
          alt="Hawker Uncle"
          fill
          className="object-contain object-bottom"
          onError={(e) => {
            // Show placeholder silhouette
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
          }}
        />
        {/* Fallback silhouette if no NPC image */}
        <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
          <div className="w-32 h-48 bg-gray-600 rounded-t-full opacity-60" />
        </div>
      </div>

      {/* z=4: Speech bubble */}
      <SpeechBubble text={npcResponse} loading={npcLoading} />
    </div>
  )
}
