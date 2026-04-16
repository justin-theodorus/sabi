import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { EmotionTimeline } from "../components/EmotionTimeline";
import { RadarChart } from "../components/RadarChart";

const TRANSCRIPT_LINES = [
  { speaker: "NPC", text: "Hello! What would you like today?" },
  { speaker: "Learner", text: "I  want  food  please" },
  { speaker: "NPC", text: "Sure! Chicken rice or noodles?" },
  { speaker: "Learner", text: "chicken  rice  please" },
  { speaker: "NPC", text: "Coming right up! Anything to drink?" },
  { speaker: "Learner", text: "tea  please  thank you" },
];

// Scene 6: 420 frames (14s)
// Panel stagger: radar @ 20, timeline @ 70, transcript @ 120
export const TherapistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  function panelSpring(startFrame: number) {
    const spr = spring({
      frame: frame - startFrame,
      fps,
      config: { damping: 18, stiffness: 120, mass: 0.9 },
    });
    return {
      opacity: interpolate(spr, [0, 1], [0, 1]),
      translateY: interpolate(spr, [0, 1], [40, 0]),
    };
  }

  const radar = panelSpring(20);
  const timeline = panelSpring(60);
  const transcript = panelSpring(100);

  const overlayOpacity = interpolate(frame, [280, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #F8FAFC 0%, #EFF6FF 100%)",
        opacity: bgOpacity,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 72,
          right: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 800,
            fontSize: 32,
            color: "#111827",
            opacity: interpolate(frame, [10, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Session Report — Aditya, 14 Apr 2026
        </p>
        <span
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(0,0,0,0.35)",
            opacity: interpolate(frame, [15, 35], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Hawker Centre · Learning Mode · 4m 32s
        </span>
      </div>

      {/* Divider */}
      <div
        style={{
          position: "absolute",
          top: 118,
          left: 72,
          right: 72,
          height: 1,
          background: "rgba(0,0,0,0.1)",
          transform: `scaleX(${interpolate(frame, [25, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
          transformOrigin: "left",
        }}
      />

      {/* === Left: Radar chart === */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 72,
          opacity: radar.opacity,
          transform: `translateY(${radar.translateY}px)`,
        }}
      >
        <p
          style={{
            margin: "0 0 16px 16px",
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "rgba(0,0,0,0.45)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Communication Competence
        </p>
        <RadarChart animateStart={25} />
      </div>

      {/* === Centre-right: Emotion timeline + transcript === */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 660,
          right: 72,
          display: "flex",
          flexDirection: "column",
          gap: 48,
        }}
      >
        {/* Emotion timeline */}
        <div
          style={{
            opacity: timeline.opacity,
            transform: `translateY(${timeline.translateY}px)`,
          }}
        >
          <p
            style={{
              margin: "0 0 20px",
              fontFamily: "'Inter', Arial, sans-serif",
              fontWeight: 700,
              fontSize: 20,
              color: "rgba(0,0,0,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Emotion Timeline
          </p>
          <EmotionTimeline animateStart={65} width={1100} />
        </div>

        {/* Transcript */}
        <div
          style={{
            opacity: transcript.opacity,
            transform: `translateY(${transcript.translateY}px)`,
          }}
        >
          <p
            style={{
              margin: "0 0 20px",
              fontFamily: "'Inter', Arial, sans-serif",
              fontWeight: 700,
              fontSize: 20,
              color: "rgba(0,0,0,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Session Transcript
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {TRANSCRIPT_LINES.map((line, i) => {
              const lineOpacity = interpolate(
                frame,
                [105 + i * 14, 120 + i * 14],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const isLearner = line.speaker === "Learner";
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    opacity: lineOpacity,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Inter', Arial, sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: isLearner ? "#2563EB" : "rgba(0,0,0,0.35)",
                      minWidth: 80,
                      paddingTop: 3,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {line.speaker}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Inter', Arial, sans-serif",
                      fontSize: 20,
                      fontWeight: isLearner ? 600 : 400,
                      color: isLearner ? "#1E3A5F" : "rgba(0,0,0,0.7)",
                      lineHeight: 1.5,
                    }}
                  >
                    {line.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom overlay text */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 72,
          right: 72,
          opacity: overlayOpacity,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 700,
            fontSize: 34,
            color: "#111827",
            textShadow: "0 2px 12px rgba(0,0,0,0.08)",
          }}
        >
          Therapists get the full picture — every session, every emotion, every word.
        </p>
      </div>
    </AbsoluteFill>
  );
};
