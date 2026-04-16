import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { AACIconGrid } from "../components/AACIconGrid";
import { HintBar } from "../components/HintBar";
import { SpeechBubble } from "../components/SpeechBubble";

// Scene 4: 750 frames (25s) @ 30fps
// 4a Stage:      0–187   (6.3s)
// 4b AAC Board:  188–374 (6.2s)
// 4c AI Resp:    375–561 (6.2s)
// 4d Hint Bar:   562–749 (6.3s)

const SUB = {
  stage: { from: 0, dur: 188 },
  aac: { from: 188, dur: 187 },
  resp: { from: 375, dur: 187 },
  hint: { from: 562, dur: 188 },
};

// Full-width subtitle strip at the very bottom — never overlaps NPC or AAC board
function Caption({
  text,
  startFrame = 0,
}: {
  text: string;
  startFrame?: number;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [startFrame, startFrame + 18], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "16px 60px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 15,
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 600,
          fontSize: 30,
          color: "#111827",
        }}
      >
        {text}
      </p>
    </div>
  );
}

export const LearnerDemoScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const npcSlide = interpolate(frame, [15, 50], [-200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const npcOpacity = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showFirstBubble = frame < SUB.resp.from + 15;
  const showSecondBubble = frame >= SUB.resp.from;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* === BACKGROUND === */}
      <div style={{ position: "absolute", inset: 0, opacity: bgOpacity }}>
        <Img
          src={staticFile("backgrounds/hawker-centre.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* === MODE BADGE (top-left) === */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 48,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(8px)",
          borderRadius: 40,
          padding: "10px 28px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: bgOpacity,
          zIndex: 10,
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#16A34A",
            boxShadow: "0 0 8px #16A34A",
          }}
        />
        <span
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "#111827",
            letterSpacing: "0.05em",
          }}
        >
          LEARNING MODE
        </span>
      </div>

      {/* === NPC — left side === */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 60,
          opacity: npcOpacity,
          transform: `translateX(${npcSlide}px)`,
          zIndex: 3,
        }}
      >
        <Img
          src={staticFile("npc/uncle/happy.png")}
          style={{ height: 720, objectFit: "contain" }}
        />
      </div>

      {/* === SPEECH BUBBLE — floats directly above the NPC head === */}
      {showFirstBubble && (
        <SpeechBubble
          text="Hello! What would you like today?"
          revealStart={30}
          revealDuration={40}
          x={60}
          y={220}
          width={520}
        />
      )}
      {showSecondBubble && (
        <SpeechBubble
          text="Sure! Chicken rice or noodles?"
          revealStart={SUB.resp.from + 10}
          revealDuration={38}
          x={60}
          y={220}
          width={500}
        />
      )}

      {/* === 4a: Stage description caption === */}
      <Sequence from={SUB.stage.from} durationInFrames={SUB.stage.dur}>
        <Caption
          text="A real-world scenario. Powered by Claude AI."
          startFrame={60}
        />
      </Sequence>

      {/* === 4b: AAC Board (right-aligned) + caption === */}
      <Sequence from={SUB.aac.from} durationInFrames={SUB.aac.dur}>
        <AACIconGrid slideInStart={10} tapStart={40} />
        <Caption
          text="Learners communicate using pictogram icons."
          startFrame={20}
        />
      </Sequence>

      {/* Keep AAC board visible through 4c and 4d */}
      <Sequence from={SUB.resp.from} durationInFrames={SUB.resp.dur + SUB.hint.dur}>
        <AACIconGrid slideInStart={0} tapStart={-999} />
      </Sequence>

      {/* === 4c: AI response caption === */}
      <Sequence from={SUB.resp.from} durationInFrames={SUB.resp.dur}>
        <Caption
          text="The AI responds naturally — every time, differently."
          startFrame={25}
        />
      </Sequence>

      {/* === 4d: Hint bar + caption === */}
      <Sequence from={SUB.hint.from} durationInFrames={SUB.hint.dur}>
        <Caption
          text="Sabi guides learners with real-time hints."
          startFrame={10}
        />
        <HintBar
          text="Try adding a polite greeting before your order."
          slideInStart={25}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
