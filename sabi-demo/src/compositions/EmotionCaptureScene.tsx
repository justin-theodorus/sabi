import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Simulated face mesh dots — 20 key landmark positions (normalised 0-1)
const MESH_POINTS = [
  [0.50, 0.20], [0.42, 0.28], [0.58, 0.28],
  [0.36, 0.38], [0.64, 0.38], [0.50, 0.40],
  [0.38, 0.50], [0.62, 0.50], [0.44, 0.60],
  [0.56, 0.60], [0.50, 0.65], [0.42, 0.72],
  [0.58, 0.72], [0.50, 0.78], [0.35, 0.55],
  [0.65, 0.55], [0.40, 0.32], [0.60, 0.32],
  [0.46, 0.44], [0.54, 0.44],
];

const EMOTION_SEQUENCE = [
  { label: "😐 Neutral", color: "#1D4ED8", start: 10 },
  { label: "😊 Confident", color: "#15803D", start: 55 },
  { label: "😰 Nervous", color: "#9333EA", start: 105 },
  { label: "😊 Happy", color: "#D97706", start: 155 },
];

// Scene: 270 frames (9s)
export const EmotionCaptureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Which emotion is currently displayed
  const currentEmotion = [...EMOTION_SEQUENCE]
    .reverse()
    .find((e) => frame >= e.start) ?? EMOTION_SEQUENCE[0];

  const nextEmotion = EMOTION_SEQUENCE.find((e) => e.start > frame);

  // Emotion label swap transition
  const emotionOpacity = nextEmotion
    ? interpolate(frame, [nextEmotion.start - 8, nextEmotion.start + 6], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Webcam frame entrance
  const webcamSpring = spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 130, mass: 0.8 } });
  const webcamScale = interpolate(webcamSpring, [0, 1], [0.85, 1]);
  const webcamOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dot pulse animation
  const dotPulse = Math.sin(frame * 0.15) * 0.3 + 0.85;

  const WEBCAM_W = 600;
  const WEBCAM_H = 520;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #F8FAFC 0%, #EFF6FF 100%)",
        opacity: bgOpacity,
      }}
    >
      {/* === Left: heading === */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: "50%",
          transform: "translateY(-50%)",
          maxWidth: 580,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {[
          { text: "Real-time emotion analysis.", weight: 800, size: 56, color: "#111827" },
          { text: "DeepFace AI reads the learner's facial expressions every second.", weight: 300, size: 30, color: "rgba(0,0,0,0.55)" },
          { text: "Therapists see the full emotional arc — not just what was said.", weight: 400, size: 28, color: "rgba(0,0,0,0.4)" },
        ].map((line, i) => {
          const start = 25 + i * 30;
          const op = interpolate(frame, [start, start + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const tx = interpolate(frame, [start, start + 20], [-20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <p
              key={i}
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: line.weight,
                fontSize: line.size,
                color: line.color,
                lineHeight: 1.35,
                opacity: op,
                transform: `translateX(${tx}px)`,
              }}
            >
              {line.text}
            </p>
          );
        })}
      </div>

      {/* === Right: simulated webcam feed with face mesh === */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: "50%",
          transform: `translateY(-50%) scale(${webcamScale})`,
          opacity: webcamOpacity,
          width: WEBCAM_W,
        }}
      >
        {/* Webcam bezel */}
        <div
          style={{
            width: WEBCAM_W,
            height: WEBCAM_H,
            borderRadius: 20,
            background: "#F1F5F9",
            border: "3px solid rgba(0,0,0,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.1)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Simulated face silhouette */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 240,
              height: 300,
              borderRadius: "50% 50% 45% 45%",
              background: "rgba(200,160,120,0.12)",
              border: "2px solid rgba(200,160,120,0.2)",
            }}
          />

          {/* Face mesh dots */}
          {MESH_POINTS.map(([nx, ny], i) => {
            const dotOpacity = interpolate(frame, [30 + i * 2, 45 + i * 2], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: nx * WEBCAM_W,
                  top: ny * WEBCAM_H,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#2563EB",
                  transform: `translate(-50%, -50%) scale(${dotPulse})`,
                  boxShadow: "0 0 6px rgba(37,99,235,0.5)",
                  opacity: dotOpacity * 0.9,
                }}
              />
            );
          })}

          {/* Recording indicator */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#FF1744",
                boxShadow: `0 0 ${8 + Math.sin(frame * 0.2) * 4}px #FF1744`,
              }}
            />
            <span
              style={{
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: "rgba(0,0,0,0.5)",
                letterSpacing: "0.08em",
              }}
            >
              LIVE
            </span>
          </div>

          {/* 468 pts label */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: 13,
              color: "#2563EB",
              fontWeight: 600,
            }}
          >
            468 pts · MediaPipe Face Mesh
          </div>
        </div>

        {/* Emotion badge below webcam */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: `2px solid ${currentEmotion.color}`,
              borderRadius: 40,
              padding: "12px 36px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: emotionOpacity,
              boxShadow: `0 0 20px ${currentEmotion.color}22`,
            }}
          >
            <span style={{ fontSize: 28 }}>{currentEmotion.label.split(" ")[0]}</span>
            <span
              style={{
                fontFamily: "'Inter', Arial, sans-serif",
                fontWeight: 700,
                fontSize: 24,
                color: currentEmotion.color,
              }}
            >
              {currentEmotion.label.split(" ").slice(1).join(" ")}
            </span>
          </div>

          {/* Confidence bar */}
          <div
            style={{
              height: 8,
              width: 160,
              background: "rgba(0,0,0,0.08)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${72 + Math.sin(frame * 0.08) * 12}%`,
                background: currentEmotion.color,
                borderRadius: 4,
                transition: "width 0.1s",
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
