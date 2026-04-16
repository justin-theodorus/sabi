import { AbsoluteFill, Sequence } from "remotion";
import { HookScene } from "./compositions/HookScene";
import { ProblemScene } from "./compositions/ProblemScene";
import { IntroScene } from "./compositions/IntroScene";
import { LearnerDemoScene } from "./compositions/LearnerDemoScene";
import { SurvivalScene } from "./compositions/SurvivalScene";
import { EmotionCaptureScene } from "./compositions/EmotionCaptureScene";
import { PersonaScene } from "./compositions/PersonaScene";
import { TherapistScene } from "./compositions/TherapistScene";
import { ImpactScene } from "./compositions/ImpactScene";
import { CTAScene } from "./compositions/CTAScene";

// Scene timing @ 30fps
// Scene 1 – Hook:            0    → 300   (10s)
// Scene 2 – Problem:         300  → 660   (12s)
// Scene 3 – Intro:           660  → 1050  (13s)
// Scene 4 – Learner Demo:    1050 → 1800  (25s)
// Scene 5 – Survival:        1800 → 2040  (8s)
// Scene 6 – Emotion Capture: 2040 → 2310  (9s)
// Scene 7 – Persona:         2310 → 2580  (9s)
// Scene 8 – Therapist:       2580 → 3000  (14s)
// Scene 9 – Impact:          3000 → 3510  (17s)
// Scene 10 – CTA:            3510 → 3990  (16s)
// Total: 3990 frames = 133s

export const SabiDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={300}>
        <HookScene />
      </Sequence>
      <Sequence from={300} durationInFrames={360}>
        <ProblemScene />
      </Sequence>
      <Sequence from={660} durationInFrames={390}>
        <IntroScene />
      </Sequence>
      <Sequence from={1050} durationInFrames={750}>
        <LearnerDemoScene />
      </Sequence>
      <Sequence from={1800} durationInFrames={240}>
        <SurvivalScene />
      </Sequence>
      <Sequence from={2040} durationInFrames={270}>
        <EmotionCaptureScene />
      </Sequence>
      <Sequence from={2310} durationInFrames={270}>
        <PersonaScene />
      </Sequence>
      <Sequence from={2580} durationInFrames={420}>
        <TherapistScene />
      </Sequence>
      <Sequence from={3000} durationInFrames={510}>
        <ImpactScene />
      </Sequence>
      <Sequence from={3510} durationInFrames={480}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
