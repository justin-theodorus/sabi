import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const LINES = [
  "Practice. Anywhere. Anytime.",
  "Adaptive scenarios. Real AI responses.",
  "Built for AAC users. Built with empathy.",
];

// Scene 7: 510 frames (17s)
export const ImpactScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame: frame - 340,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  const logoOpacity = interpolate(frame, [340, 365], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 56,
      }}
    >
      {/* Subtle radial tint */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(219,234,254,0.5) 0%, transparent 70%)",
        }}
      />

      {/* Text lines */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 32,
          alignItems: "center",
          zIndex: 1,
        }}
      >
        {LINES.map((line, i) => {
          const startFrame = 30 + i * 55;
          const spr = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 20, stiffness: 140, mass: 0.7 },
          });
          const opacity = interpolate(spr, [0, 1], [0, 1]);
          const translateY = interpolate(spr, [0, 1], [30, 0]);

          return (
            <p
              key={i}
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: i === 0 ? 800 : 400,
                fontSize: i === 0 ? 64 : 52,
                color: i === 0 ? "#111827" : "rgba(0,0,0,0.6)",
                opacity,
                transform: `translateY(${translateY}px)`,
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {line}
            </p>
          );
        })}
      </div>

      {/* Divider */}
      <div
        style={{
          height: 2,
          width: interpolate(frame, [280, 330], [0, 560], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          background: "linear-gradient(to right, #42A5F5, #7E57C2, #EC407A)",
          borderRadius: 2,
          zIndex: 1,
        }}
      />

      {/* Logo re-entry */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoScale, [0, 1], [0.75, 1])})`,
          zIndex: 1,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 900,
            fontSize: 120,
            letterSpacing: "-0.04em",
            color: "#111827",
            textShadow: "0 0 60px rgba(37,99,235,0.15)",
          }}
        >
          SABI
        </p>
      </div>
    </AbsoluteFill>
  );
};
