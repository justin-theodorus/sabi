"use client";

import { useState } from "react";
import Image from "next/image";

interface ScenarioStageProps {
  backgroundSrc?: string;
  npcSrc?: string;
  npcEmotion?: string; // NPC's current emotion (happy, sad, mad, confused, surprised, neutral)
  activeEventText?: string | null; // text shown in the intruder event bubble
}

/** A secondary speech bubble used for unexpected scenario events */
function IntruderBubble({ text }: { text: string }) {
  return (
    <div
      className="absolute left-3 top-3 max-w-[55%] animate-in fade-in slide-in-from-top-2 duration-300"
      style={{ zIndex: 5 }}
    >
      <div className="relative bg-amber-50 border-2 border-amber-400 rounded-2xl rounded-tl-sm px-3 py-2 shadow-lg">
        <div className="flex items-start gap-1.5">
          <span className="text-base flex-shrink-0 mt-0.5">⚠️</span>
          <p className="text-gray-800 text-xs font-semibold leading-snug italic">{text}</p>
        </div>
        {/* Tail */}
        <div className="absolute -top-0.5 left-3 w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '7px solid #f59e0b',
          }}
        />
      </div>
    </div>
  );
}

export default function ScenarioStage({
  backgroundSrc = "/backgrounds/hawker-centre.jpg",
  npcSrc = "/npc/uncle/happy.png",
  npcEmotion,
  activeEventText,
}: ScenarioStageProps) {
  const [bgError, setBgError] = useState(false);
  const [npcError, setNpcError] = useState(false);

  // Determine NPC image path based on emotion.
  // Always use the real uncle emotion images; fall back to neutral when no emotion is detected yet.
  const getNpcImagePath = () => {
    if (npcEmotion) {
      return `/npc/uncle/${npcEmotion}.png`;
    }
    // If the caller provided a non-default npcSrc (i.e. a different scenario's NPC),
    // use it. Otherwise default to the uncle neutral shot.
    if (npcSrc && npcSrc !== '/npc/hawker-uncle.png') {
      return npcSrc;
    }
    return '/npc/uncle/neutral.png';
  };

  const npcImageSrc = getNpcImagePath();

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      {/* z=1: Black fallback */}
      <div className="absolute inset-0 bg-black" style={{ zIndex: 1 }} />

      {/* z=2: Background photo */}
      {!bgError && (
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          <Image
            src={backgroundSrc}
            alt="Scenario background"
            fill
            className="object-cover"
            onError={() => setBgError(true)}
            priority
          />
        </div>
      )}

      {/* z=3: NPC photo — anchored to bottom so feet touch the ground */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[60%]"
        style={{ zIndex: 3, bottom: 0, height: '70%' }}
      >
        {!npcError && (
          <Image
            src={npcImageSrc}
            alt="NPC character"
            fill
            className="object-contain object-bottom transition-all duration-300"
            onError={() => setNpcError(true)}
          />
        )}
        {npcError && (
          <div className="flex justify-center pt-4">
            <div className="w-48 h-72 bg-gray-600 rounded-t-full opacity-60" />
          </div>
        )}
      </div>

      {/* z=4: Intruder event bubble */}
      {activeEventText && <IntruderBubble text={activeEventText} />}
    </div>
  );
}
