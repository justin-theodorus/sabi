import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Exact personas from persona-engine/main.py
const PERSONAS = [
  {
    key: "shy_chick",
    name: "Shy Chick",
    icon: "🐣",
    color: "#C2185B",
    trigger: "Latency > 20s or > 3 re-prompts",
    traits: ["Hesitant, low confidence", "Needs encouragement", "Frequent re-prompts"],
    modifier: "More hints · Slower NPC pacing · Warm, supportive tone",
  },
  {
    key: "steady_turtle",
    name: "Steady Turtle",
    icon: "🐢",
    color: "#00796B",
    trigger: "Moderate pace, thoughtful",
    traits: ["Reflective communicator", "Consistent icon usage", "Methodical responses"],
    modifier: "Natural pacing · Balanced prompting · Calm NPC",
  },
  {
    key: "curious_monkey",
    name: "Curious Monkey",
    icon: "🐒",
    color: "#E65100",
    trigger: "Latency < 15s, ≥ 2 icons/msg",
    traits: ["Exploratory style", "Varied icon patterns", "Flexible communicator"],
    modifier: "Varied scenarios · Playful NPC · Light hints",
  },
  {
    key: "zippy_sotong",
    name: "Zippy Sotong",
    icon: "🦑",
    color: "#BF360C",
    trigger: "Latency < 5s but < 2 icons/msg",
    traits: ["Very fast responses", "Simple icon combos", "Needs structure coaching"],
    modifier: "Structure-focused hints · Encourage richer combos",
  },
  {
    key: "garang_crab",
    name: "Garang Crab",
    icon: "🦀",
    color: "#1565C0",
    trigger: "Latency < 10s, ≤ 1 re-prompt, ≥ 3 icons",
    traits: ["Fast & independent", "Rich icon combos", "Minimal support needed"],
    modifier: "Minimal hints · Dynamic NPC · Challenging scenarios",
  },
];

const METRICS = [
  { label: "Avg Response Latency", key: "latency" },
  { label: "Re-prompt Count", key: "reprompts" },
  { label: "Avg Icons / Message", key: "icons" },
];

// Scene: 270 frames (9s)
export const PersonaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Spotlight the garang_crab card (index 4) as the "active" example
  const ACTIVE = 4;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(150deg, #F8FAFC 0%, #EFF6FF 100%)",
        opacity: bgOpacity,
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 48, left: 80, right: 80 }}>
        {[
          { text: "Adaptive Personas.", weight: 800, size: 58, color: "#111827" },
          {
            text: "SABI classifies each learner in a 3–5 min preliminary session. Every AI prompt adapts.",
            weight: 300,
            size: 26,
            color: "rgba(0,0,0,0.5)",
          },
        ].map((line, i) => {
          const op = interpolate(frame, [10 + i * 18, 28 + i * 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const ty = interpolate(frame, [10 + i * 18, 28 + i * 18], [14, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "10px 0 0",
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: line.weight,
                fontSize: line.size,
                color: line.color,
                opacity: op,
                transform: `translateY(${ty}px)`,
                lineHeight: 1.2,
              }}
            >
              {line.text}
            </p>
          );
        })}
      </div>

      {/* Divider */}
      <div
        style={{
          position: "absolute",
          top: 196,
          left: 80,
          right: 80,
          height: 1,
          background: "rgba(0,0,0,0.1)",
          transform: `scaleX(${interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
          transformOrigin: "left",
        }}
      />

      {/* === Persona cards (5 across) === */}
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 80,
          right: 80,
          display: "flex",
          gap: 20,
        }}
      >
        {PERSONAS.map((p, i) => {
          const cardStart = 45 + i * 18;
          const spr = spring({ frame: frame - cardStart, fps, config: { damping: 18, stiffness: 130, mass: 0.8 } });
          const cardOpacity = interpolate(spr, [0, 1], [0, 1]);
          const cardY = interpolate(spr, [0, 1], [36, 0]);
          const isActive = i === ACTIVE;
          const activeGlow = isActive
            ? interpolate(frame, [110, 145], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 0;

          return (
            <div
              key={p.key}
              style={{
                flex: 1,
                background: isActive
                  ? "rgba(239,246,255,0.95)"
                  : "rgba(255,255,255,0.7)",
                border: `2px solid ${isActive ? p.color : "rgba(0,0,0,0.08)"}`,
                borderRadius: 18,
                padding: "24px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                boxShadow: isActive
                  ? `0 0 ${36 * activeGlow}px ${p.color}33, 0 4px 16px rgba(0,0,0,0.08)`
                  : "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              {/* Icon + Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{p.icon}</span>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontWeight: 800,
                    fontSize: 17,
                    color: p.color,
                    lineHeight: 1.2,
                  }}
                >
                  {p.name}
                </p>
              </div>

              {/* Trigger condition */}
              <p
                style={{
                  margin: 0,
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: `${p.color}CC`,
                  fontStyle: "italic",
                  lineHeight: 1.4,
                }}
              >
                {p.trigger}
              </p>

              {/* Traits */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {p.traits.map((t, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: p.color,
                        flexShrink: 0,
                        marginTop: 7,
                        opacity: 0.6,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'Inter', Arial, sans-serif",
                        fontSize: 14,
                        color: "rgba(0,0,0,0.6)",
                        lineHeight: 1.4,
                      }}
                    >
                      {t}
                    </span>
                  </div>
                ))}
              </div>

              {/* Active card: AI Prompt Modifier */}
              {isActive && (
                <div
                  style={{
                    marginTop: 6,
                    borderTop: `1px solid ${p.color}33`,
                    paddingTop: 12,
                    opacity: activeGlow,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontFamily: "'Inter', Arial, sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: p.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    AI Prompt Modifier
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "'Inter', Arial, sans-serif",
                      fontSize: 13,
                      color: "rgba(0,0,0,0.5)",
                      lineHeight: 1.5,
                    }}
                  >
                    {p.modifier}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* === Bottom: Classification inputs === */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 80,
          right: 80,
          display: "flex",
          alignItems: "center",
          gap: 0,
          opacity: interpolate(frame, [155, 178], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(0,0,0,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginRight: 32,
            flexShrink: 0,
          }}
        >
          Classified by:
        </p>
        {METRICS.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.6)",
                }}
              >
                {m.label}
              </span>
            </div>
            {i < METRICS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "rgba(0,0,0,0.1)",
                  margin: "0 28px",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
