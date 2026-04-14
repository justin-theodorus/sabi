"use client";

import { useState } from "react";
import Image from "next/image";
import SpeechBubble from "./SpeechBubble";

interface ScenarioStageProps {
  npcResponse: string | null;
  npcLoading: boolean;
  backgroundSrc?: string;
  npcSrc?: string;
  npcEmotion?: string; // NPC's current emotion (happy, sad, mad, confused, surprised, neutral)
}

export default function ScenarioStage({
  npcResponse,
  npcLoading,
  backgroundSrc = "/backgrounds/hawker-centre.jpg",
  npcSrc = "/npc/hawker-uncle.png",
  npcEmotion,
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

      {/* z=3: NPC photo — anchored to bottom, sized to show full figure */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[72%]"
        style={{ zIndex: 3, bottom: 0, height: "92%" }}
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

      {/* z=4: Speech bubble */}
      <SpeechBubble text={npcResponse} loading={npcLoading} />
    </div>
  );
}
