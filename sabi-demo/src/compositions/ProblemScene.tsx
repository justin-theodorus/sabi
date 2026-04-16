import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const TEXT_LINES = [
  "They rely on AAC devices —",
  "but learning to use them takes practice.",
  "Real practice. Safe practice.",
];

// Scene 2: 360 frames (12s)
export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#F8FAFC" }}>
      {/* Background image — left half */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "55%",
          height: "100%",
          opacity: bgOpacity,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("backgrounds/hawker-centre.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Light fade to right panel */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, transparent 50%, rgba(248,250,252,0.97) 100%)",
          }}
        />
      </div>

      {/* Right panel — text */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "48%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 80px 0 40px",
          gap: 28,
        }}
      >
        {TEXT_LINES.map((line, i) => {
          const startFrame = 30 + i * 22;
          const spr = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 18, stiffness: 150, mass: 0.8 },
          });
          const opacity = interpolate(spr, [0, 1], [0, 1]);
          const translateX = interpolate(spr, [0, 1], [40, 0]);

          return (
            <p
              key={i}
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: i === 2 ? 800 : 400,
                fontSize: i === 2 ? 52 : 42,
                color: i === 2 ? "#111827" : "rgba(0,0,0,0.65)",
                lineHeight: 1.35,
                opacity,
                transform: `translateX(${translateX}px)`,
              }}
            >
              {line}
            </p>
          );
        })}

        {/* Accent line */}
        {(() => {
          const lineOpacity = interpolate(frame, [110, 130], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const lineWidth = interpolate(frame, [110, 160], [0, 220], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              style={{
                height: 4,
                width: lineWidth,
                background: "linear-gradient(to right, #42A5F5, #7E57C2)",
                borderRadius: 2,
                opacity: lineOpacity,
                marginTop: 8,
              }}
            />
          );
        })()}
      </div>
    </AbsoluteFill>
  );
};
