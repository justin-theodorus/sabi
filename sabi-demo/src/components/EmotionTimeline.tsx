import { interpolate, useCurrentFrame } from "remotion";

const EMOTIONS = [
  { emoji: "😊", label: "happy", color: "#FFD54F", time: 0.05 },
  { emoji: "😊", label: "happy", color: "#FFD54F", time: 0.12 },
  { emoji: "😰", label: "nervous", color: "#CE93D8", time: 0.22 },
  { emoji: "😊", label: "happy", color: "#FFD54F", time: 0.31 },
  { emoji: "😮", label: "surprised", color: "#80DEEA", time: 0.40 },
  { emoji: "😊", label: "happy", color: "#FFD54F", time: 0.50 },
  { emoji: "😰", label: "nervous", color: "#CE93D8", time: 0.58 },
  { emoji: "😊", label: "happy", color: "#FFD54F", time: 0.67 },
  { emoji: "😄", label: "excited", color: "#A5D6A7", time: 0.78 },
  { emoji: "😄", label: "excited", color: "#A5D6A7", time: 0.88 },
  { emoji: "😄", label: "excited", color: "#A5D6A7", time: 0.95 },
];

interface EmotionTimelineProps {
  animateStart?: number;
  width?: number;
}

export const EmotionTimeline: React.FC<EmotionTimelineProps> = ({
  animateStart = 0,
  width = 800,
}) => {
  const frame = useCurrentFrame();

  const lineWidth = interpolate(
    frame,
    [animateStart, animateStart + 35],
    [0, width],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const DOT_TOP = 28;

  return (
    <div style={{ position: "relative", width, height: 110 }}>
      {/* Timeline bar */}
      <div
        style={{
          position: "absolute",
          top: DOT_TOP,
          left: 0,
          height: 4,
          width: lineWidth,
          background:
            "linear-gradient(to right, #42A5F5, #66BB6A, #FFA726, #AB47BC)",
          borderRadius: 2,
          transform: "translateY(-50%)",
        }}
      />

      {/* Start / End labels */}
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: 14,
          color: "rgba(0,0,0,0.4)",
        }}
      >
        0:00
      </span>
      <span
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: 14,
          color: "rgba(0,0,0,0.4)",
        }}
      >
        4:32
      </span>

      {/* Emotion dots + emoji labels */}
      {EMOTIONS.map((e, i) => {
        const dotReveal = animateStart + 20 + i * 6;
        const opacity = interpolate(frame, [dotReveal, dotReveal + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const dotScale = interpolate(
          frame,
          [dotReveal, dotReveal + 10],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: DOT_TOP - 11,
              left: e.time * width,
              transform: `translateX(-50%) scale(${dotScale})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: e.color,
                border: "2px solid rgba(0,0,0,0.15)",
                boxShadow: `0 0 8px ${e.color}88`,
              }}
            />
            <span
              style={{
                fontSize: 18,
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {e.emoji}
            </span>
          </div>
        );
      })}
    </div>
  );
};
