import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface TextCardProps {
  lines: string[];
  startFrame?: number;
  staggerFrames?: number;
  position?: "top" | "center" | "bottom";
  size?: "small" | "medium" | "large";
  color?: string;
}

export const TextCard: React.FC<TextCardProps> = ({
  lines,
  startFrame = 0,
  staggerFrames = 12,
  position = "bottom",
  size = "medium",
  color = "#ffffff",
}) => {
  const frame = useCurrentFrame();

  const fontSize =
    size === "large" ? 52 : size === "medium" ? 38 : 28;

  const verticalAlign =
    position === "top"
      ? { top: 80 }
      : position === "center"
      ? { top: "50%", transform: "translateY(-50%)" }
      : { bottom: 100 };

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "flex-start",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          ...verticalAlign,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {lines.map((line, i) => {
          const lineStart = startFrame + i * staggerFrames;
          const opacity = interpolate(
            frame,
            [lineStart, lineStart + 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const translateY = interpolate(
            frame,
            [lineStart, lineStart + 18],
            [20, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <p
              key={i}
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: 700,
                fontSize,
                color,
                opacity,
                transform: `translateY(${translateY}px)`,
                textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                lineHeight: 1.25,
              }}
            >
              {line}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
