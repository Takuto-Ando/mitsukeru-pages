import type { Stroke } from "./types";
export function Eye({ answer = false }: { answer?: boolean }) {
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      className="eye-template"
      role={answer ? "img" : undefined}
      aria-label={answer ? "ヤギの横長の瞳孔の模式図" : undefined}
      aria-hidden={answer ? undefined : true}
    >
      <EyeOutline />
      {answer ? (
        <PupilShape />
      ) : (
        <rect
          x="219"
          y="190"
          width="168"
          height="59"
          rx="13"
          fill="#fffef8"
          stroke="#4c9b92"
          strokeDasharray="5 5"
        />
      )}
    </svg>
  );
}
export function Sketch({ strokes }: { strokes: Stroke[] }) {
  return (
    <svg
      className="sketch-preview"
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      role="img"
      aria-label="自分が描いた形"
    >
      <SketchLines strokes={strokes} />
    </svg>
  );
}
export function Celebration() {
  return (
    <div className="celebration" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <i
          key={index}
          style={
            {
              "--index": index,
              "--angle": (index * 360) / 14 + "deg",
            } as React.CSSProperties
          }
        />
      ))}
      <span>✦</span>
    </div>
  );
}

export function EyeOutline() {
  const base = import.meta.env.BASE_URL + "figma/2-26-";
  return (
    <g>
      <image
        href={base + "imgEyeOuter.svg"}
        x="29"
        y="84"
        width="543"
        height="266"
      />
      <image
        href={base + "imgEyeIris.svg"}
        x="176"
        y="120"
        width="250"
        height="194"
      />
    </g>
  );
}

// Placeholder artwork: replace this component with a calibrated SVG/image
// within the same 600 × 400 coordinate system when formal assets arrive.
export function PupilShape({ fill = "#4c4237" }: { fill?: string }) {
  return <rect x="219" y="190" width="168" height="59" rx="13" fill={fill} />;
}

export function SketchLines({ strokes }: { strokes: Stroke[] }) {
  return (
    <g>
      {" "}
      {strokes.map((stroke, index) => (
        <polyline
          key={index}
          points={stroke.map((point) => point.x + "," + point.y).join(" ")}
          fill="none"
          stroke="#277e78"
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}
