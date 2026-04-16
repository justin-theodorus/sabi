import { Composition } from "remotion";
import { SabiDemo } from "./SabiDemo";

// Total: 3990 frames @ 30fps = 133 seconds
export const Root: React.FC = () => {
  return (
    <Composition
      id="SabiDemo"
      component={SabiDemo}
      durationInFrames={3990}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
