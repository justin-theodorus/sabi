import { interpolate, useCurrentFrame } from "remotion";

const CX = 260;
const CY = 260;
const R_MAX = 200;

const DIMENSIONS = [
  "Operational",
  "Linguistic",
  "Social",
  "Strategic",
  "Confidence",
];

const SCORES = [0.72, 0.81, 0.68, 0.76, 0.85];

// Pentagon: n=5, start at -90deg
function polarToXY(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

const ANGLES = [-90, -18, 54, 126, 198];

function buildPolygon(scores: number[], scale: number): string {
  return ANGLES.map((a, i) => {
    const { x, y } = polarToXY(a, R_MAX * scores[i] * scale);
    return `${x},${y}`;
  }).join(" ");
}

function buildGridPolygon(fraction: number): string {
  return ANGLES.map((a) => {
    const { x, y } = polarToXY(a, R_MAX * fraction);
    return `${x},${y}`;
  }).join(" ");
}

interface RadarChartProps {
  animateStart?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({ animateStart = 0 }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [animateStart, animateStart + 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelOpacity = interpolate(
    frame,
    [animateStart + 40, animateStart + 65],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <svg width={520} height={520} style={{ overflow: "visible" }}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1.0].map((frac) => (
        <polygon
          key={frac}
          points={buildGridPolygon(frac)}
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth={1.5}
        />
      ))}

      {/* Axis lines */}
      {ANGLES.map((a, i) => {
        const end = polarToXY(a, R_MAX);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={end.x}
            y2={end.y}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Filled data polygon — scales in */}
      <polygon
        points={buildPolygon(SCORES, scale)}
        fill="rgba(37,99,235,0.15)"
        stroke="#2563EB"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {ANGLES.map((a, i) => {
        const { x, y } = polarToXY(a, R_MAX * SCORES[i] * scale);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={6}
            fill="#2563EB"
            stroke="#fff"
            strokeWidth={2}
          />
        );
      })}

      {/* Labels */}
      {ANGLES.map((a, i) => {
        const labelR = R_MAX + 36;
        const { x, y } = polarToXY(a, labelR);
        const textAnchor =
          x < CX - 10 ? "end" : x > CX + 10 ? "start" : "middle";
        return (
          <text
            key={i}
            x={x}
            y={y + 6}
            textAnchor={textAnchor}
            fontFamily="'Inter', Arial, sans-serif"
            fontWeight="700"
            fontSize="18"
            fill="#111827"
            opacity={labelOpacity}
          >
            {DIMENSIONS[i]}
          </text>
        );
      })}
    </svg>
  );
};
