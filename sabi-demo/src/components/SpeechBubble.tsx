import { interpolate, useCurrentFrame } from "remotion";

interface SpeechBubbleProps {
  text: string;
  revealStart?: number;
  revealDuration?: number;
  x: number;
  y: number;
  width?: number;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  revealStart = 0,
  revealDuration = 45,
  x,
  y,
  width = 520,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [revealStart, revealStart + revealDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const charsToShow = Math.floor(progress * text.length);
  const displayText = text.slice(0, charsToShow);

  const bubbleOpacity = interpolate(
    frame,
    [revealStart, revealStart + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scale = interpolate(
    frame,
    [revealStart, revealStart + 12],
    [0.85, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        opacity: bubbleOpacity,
        transform: `scale(${scale})`,
        transformOrigin: "bottom left",
        zIndex: 10,
      }}
    >
      {/* Bubble body */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: "20px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: "#1a1a1a",
            lineHeight: 1.4,
            minHeight: 42,
          }}
        >
          {displayText}
          {progress < 1 && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "1em",
                backgroundColor: "#333",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
              }}
            />
          )}
        </p>
      </div>
      {/* Tail */}
      <div
        style={{
          position: "absolute",
          bottom: -16,
          left: 48,
          width: 0,
          height: 0,
          borderLeft: "16px solid transparent",
          borderRight: "16px solid transparent",
          borderTop: "18px solid #ffffff",
          filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.15))",
        }}
      />
    </div>
  );
};
