import { interpolate, useCurrentFrame } from "remotion";

interface HintBarProps {
  text: string;
  slideInStart?: number;
}

export const HintBar: React.FC<HintBarProps> = ({
  text,
  slideInStart = 0,
}) => {
  const frame = useCurrentFrame();

  const translateY = interpolate(
    frame,
    [slideInStart, slideInStart + 20],
    [100, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = interpolate(
    frame,
    [slideInStart, slideInStart + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "20px 48px",
        background: "linear-gradient(135deg, #FFF9C4 0%, #FFF176 100%)",
        borderTop: "3px solid #F9A825",
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 20,
      }}
    >
      {/* Sabi icon / mascot placeholder */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#F9A825",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 900,
            fontSize: 18,
            color: "#fff",
          }}
        >
          S
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 600,
          fontSize: 26,
          color: "#5D4037",
        }}
      >
        💡 Sabi says: <span style={{ fontWeight: 400 }}>{text}</span>
      </p>
    </div>
  );
};
