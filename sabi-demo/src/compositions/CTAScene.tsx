import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Scene 8: 480 frames (16s)
export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [40, 65], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade to white near end
  const fadeOut = interpolate(frame, [420, 480], [0, 1], {
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
        gap: 48,
      }}
    >
      {/* Subtle glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 50% 35% at 50% 50%, rgba(219,234,254,0.6) 0%, transparent 70%)",
        }}
      />

      {/* SABI logo */}
      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 900,
          fontSize: 100,
          letterSpacing: "-0.04em",
          color: "#111827",
          opacity: logoOpacity,
          textShadow: "0 0 50px rgba(37,99,235,0.12)",
          zIndex: 1,
        }}
      >
        SABI
      </p>

      {/* Divider */}
      <div
        style={{
          height: 1,
          width: interpolate(frame, [20, 55], [0, 400], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          background: "rgba(0,0,0,0.15)",
          borderRadius: 1,
          zIndex: 1,
        }}
      />

      {/* Tagline */}
      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', Arial, sans-serif",
          fontWeight: 300,
          fontSize: 30,
          color: "rgba(0,0,0,0.5)",
          letterSpacing: "0.04em",
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          zIndex: 1,
          textAlign: "center",
        }}
      >
        Empowering communication, one scenario at a time.
      </p>

      {/* Fade to white overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#fff",
          opacity: fadeOut,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
    </AbsoluteFill>
  );
};
