import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SpeechBubble } from "../components/SpeechBubble";

const MAX_HEARTS = 5;

// Scene 5: 240 frames (8s)
// Heart drains at frame 180
export const SurvivalScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Countdown: 30 → 0 fake over 8s (show it counting down from ~18)
  const countdownVal = Math.max(
    0,
    Math.round(18 - (frame / 240) * 18)
  );

  const timerColor = countdownVal < 8 ? "#FF5252" : "#FFCA28";

  // Heart drain: heart index 4 empties at frame 180
  const lastHeartOpacity = interpolate(frame, [175, 195], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red flash when heart drains
  const flashOpacity = interpolate(
    frame,
    [175, 185, 200],
    [0, 0.3, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background */}
      <div style={{ position: "absolute", inset: 0, opacity: bgOpacity }}>
        <Img
          src={staticFile("backgrounds/hawker-centre.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
          }}
        />
      </div>

      {/* Red flash overlay on heart loss */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#FF1744",
          opacity: flashOpacity,
          pointerEvents: "none",
          zIndex: 30,
        }}
      />

      {/* NPC */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 80,
          zIndex: 3,
          opacity: bgOpacity,
        }}
      >
        <Img
          src={staticFile("npc/uncle/mad.png")}
          style={{ height: 680, objectFit: "contain" }}
        />
      </div>

      {/* Speech bubble — directly above NPC head */}
      <SpeechBubble
        text="Are you going to order or not?"
        revealStart={10}
        revealDuration={35}
        x={80}
        y={230}
        width={500}
      />

      {/* Top-right HUD */}
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 48,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 16,
          zIndex: 10,
          opacity: bgOpacity,
        }}
      >
        {/* Mode badge */}
        <div
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "2px solid rgba(255,82,82,0.5)",
            borderRadius: 40,
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#FF5252",
              boxShadow: "0 0 10px #FF5252",
            }}
          />
          <span
            style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "#D32F2F",
              letterSpacing: "0.06em",
            }}
          >
            SURVIVAL MODE
          </span>
        </div>

        {/* Hearts row */}
        <div style={{ display: "flex", gap: 10 }}>
          {Array.from({ length: MAX_HEARTS }).map((_, i) => {
            const heartOpacity =
              i === MAX_HEARTS - 1 ? lastHeartOpacity : 1;
            return (
              <span
                key={i}
                style={{
                  fontSize: 44,
                  opacity: heartOpacity,
                  filter:
                    i === MAX_HEARTS - 1
                      ? `drop-shadow(0 0 6px rgba(255,82,82,${lastHeartOpacity}))`
                      : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }}
              >
                ❤️
              </span>
            );
          })}
        </div>

        {/* Countdown timer */}
        <div
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 900,
            fontSize: 80,
            color: timerColor,
            lineHeight: 1,
            textShadow: `0 0 20px ${timerColor}88`,
          }}
        >
          {String(countdownVal).padStart(2, "0")}
        </div>
      </div>

    </AbsoluteFill>
  );
};
