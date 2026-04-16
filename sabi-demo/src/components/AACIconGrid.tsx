import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

interface AACIconDef {
  label: string;
  path: string;
  category: "core" | "social" | "emotion";
}

const DEMO_ICONS: AACIconDef[] = [
  { label: "I", path: "icons/core_words/i.png", category: "core" },
  { label: "want", path: "icons/core_words/want.png", category: "core" },
  { label: "food", path: "icons/core_words/food.png", category: "core" },
  { label: "please", path: "icons/core_words/please.png", category: "core" },
  { label: "help", path: "icons/core_words/help.png", category: "core" },
  { label: "more", path: "icons/core_words/more.png", category: "core" },
  { label: "no", path: "icons/core_words/no.png", category: "core" },
  { label: "eat", path: "icons/core_words/eat.png", category: "core" },
];

const CATEGORY_COLOR: Record<string, string> = {
  core: "#e8e8e8",
  social: "#C8E6C9",
  emotion: "#F8BBD9",
};

// Sequence: frame offsets at which each icon gets "tapped"
const TAP_FRAMES = [20, 50, 80, 110]; // relative to when board is shown
const TAP_ICONS = [0, 1, 2, 3]; // indices into DEMO_ICONS

interface Props {
  slideInStart?: number;
  /** Relative frame when tapping sequence begins */
  tapStart?: number;
}

export const AACIconGrid: React.FC<Props> = ({
  slideInStart = 0,
  tapStart = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const translateY = interpolate(
    frame,
    [slideInStart, slideInStart + 25],
    [300, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = interpolate(
    frame,
    [slideInStart, slideInStart + 25],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const COLS = 4;
  const ICON_SIZE = 148;
  const GAP = 16;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        right: 80,
        transform: `translateY(${translateY}px)`,
        opacity,
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, ${ICON_SIZE}px)`,
        gap: GAP,
        padding: "20px 24px",
        background: "rgba(255,255,255,0.95)",
        borderRadius: 24,
        boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
      }}
    >
      {DEMO_ICONS.map((icon, i) => {
        const tapIdx = TAP_ICONS.indexOf(i);
        let isSelected = false;
        let pulseScale = 1;

        if (tapIdx !== -1) {
          const tapFrame = tapStart + TAP_FRAMES[tapIdx];
          if (frame >= tapFrame) isSelected = true;

          // Pulse on tap
          const pulse = spring({
            frame: frame - tapFrame,
            fps,
            config: { damping: 12, stiffness: 200, mass: 0.6 },
          });
          pulseScale = tapIdx !== -1 && frame >= tapFrame
            ? interpolate(pulse, [0, 1], [1.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 1;
        }

        return (
          <div
            key={icon.label}
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: 16,
              background: isSelected ? "#BBDEFB" : CATEGORY_COLOR[icon.category],
              border: isSelected ? "3px solid #1976D2" : "3px solid transparent",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transform: `scale(${pulseScale})`,
              boxShadow: isSelected
                ? "0 4px 16px rgba(25,118,210,0.4)"
                : "0 2px 6px rgba(0,0,0,0.1)",
              transition: "border 0.1s",
            }}
          >
            <Img
              src={staticFile(icon.path)}
              style={{ width: 80, height: 80, objectFit: "contain" }}
            />
            <span
              style={{
                fontFamily: "'Inter', Arial, sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: "#333",
                textTransform: "capitalize",
              }}
            >
              {icon.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
