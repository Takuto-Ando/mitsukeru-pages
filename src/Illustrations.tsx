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
      {answer && <PupilShape />}
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
  return (
    <g>
      {" "}
      <path
        d="M60 203Q150 94 300 123Q455 98 540 203Q450 293 300 278Q146 294 60 203Z"
        fill="#fffaf0"
        stroke="#b8a58c"
        strokeWidth="4"
      />
      <path
        d="M76 185Q155 75 302 102Q442 86 526 180"
        fill="none"
        stroke="#d9c3a4"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

// Placeholder artwork: replace this component with a calibrated SVG/image
// within the same 600 × 400 coordinate system when formal assets arrive.
export function PupilShape({ fill = "#4c4237" }: { fill?: string }) {
  return <rect x="165" y="170" width="270" height="70" rx="13" fill={fill} />;
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
