import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Scene 1: 300 frames (10s)
// Text fades in at frame 20, holds, then fades out at frame 250
export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [20, 50, 240, 280],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scale = interpolate(
    frame,
    [20, 55],
    [0.94, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Subtle radial tint */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(219,234,254,0.6) 0%, transparent 70%)",
        }}
      />

      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: "center",
          padding: "0 160px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 300,
            fontSize: 54,
            color: "#374151",
            lineHeight: 1.4,
            letterSpacing: "0.01em",
          }}
        >
          1 in 88 people in Singapore
        </p>
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 700,
            fontSize: 62,
            color: "#111827",
            lineHeight: 1.3,
          }}
        >
          cannot communicate
          <br />
          using speech alone.
        </p>
      </div>
    </AbsoluteFill>
  );
};
