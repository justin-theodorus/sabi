import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const ICONS = [
  { label: "I", path: "icons/core_words/i.png" },
  { label: "want", path: "icons/core_words/want.png" },
  { label: "please", path: "icons/core_words/please.png" },
];

// Scene 3: 390 frames (13s)
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 16, stiffness: 130, mass: 0.7 },
  });
  const logoOpacity = interpolate(frame, [20, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleY = interpolate(frame, [55, 75], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #F0F9FF 0%, #E0F2FE 60%, #F8FAFC 100%)",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 40,
      }}
    >
      {/* Subtle grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Logo wordmark */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoScale, [0, 1], [0.8, 1])})`,
          zIndex: 1,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: 900,
            fontSize: 160,
            letterSpacing: "-0.04em",
            color: "#111827",
            textShadow: "0 0 80px rgba(37,99,235,0.15)",
          }}
        >
          SABI
        </p>
      </div>

      {/* Tagline */}
      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 300,
          fontSize: 38,
          color: "rgba(0,0,0,0.55)",
          letterSpacing: "0.04em",
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          zIndex: 1,
          textAlign: "center",
        }}
      >
        AI-powered AAC communication training
      </p>

      {/* Icon trio */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 20,
          zIndex: 1,
        }}
      >
        {ICONS.map((icon, i) => {
          const iconStart = 95 + i * 18;
          const iconSpr = spring({
            frame: frame - iconStart,
            fps,
            config: { damping: 14, stiffness: 200, mass: 0.5 },
          });
          const iconOpacity = interpolate(frame, [iconStart, iconStart + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const iconY = interpolate(iconSpr, [0, 1], [40, 0]);

          return (
            <div
              key={i}
              style={{
                opacity: iconOpacity,
                transform: `translateY(${iconY}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.85)",
                  border: "2px solid rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                }}
              >
                <Img
                  src={staticFile(icon.path)}
                  style={{ width: 64, height: 64, objectFit: "contain" }}
                />
              </div>
              <span
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontWeight: 600,
                  fontSize: 18,
                  color: "rgba(0,0,0,0.55)",
                  textTransform: "capitalize",
                }}
              >
                {icon.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Blue accent glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(37,99,235,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
