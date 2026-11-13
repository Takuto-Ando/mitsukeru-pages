import { useState, type CSSProperties } from "react";
import { Play } from "lucide-react";
import { clipStrokes, type Scene } from "../content/scenes";
import { SceneBase } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import type { Stroke } from "../types";

const mouth = { x: 330, y: 188 };
const leaves = [
  { x: 458, y: 190 },
  { x: 480, y: 207 },
  { x: 449, y: 215 },
] as const;

// Rotate and scale the child's actual stroke about the mouth. Its tip lands on
// each leaf even when the child draws at a different position in the window.
export function tongueBiteTransform(
  tip: { x: number; y: number },
  leaf: { x: number; y: number },
) {
  const dx = tip.x - mouth.x;
  const dy = tip.y - mouth.y;
  const tx = leaf.x - mouth.x;
  const ty = leaf.y - mouth.y;
  const lengthSquared = dx * dx + dy * dy;
  const a = (tx * dx + ty * dy) / lengthSquared;
  const b = (ty * dx - tx * dy) / lengthSquared;
  return `matrix(${a}, ${b}, ${-b}, ${a}, ${mouth.x * (1 - a) + mouth.y * b}, ${mouth.y * (1 - a) - mouth.x * b})`;
}

const leafShape = "M0 0 Q13 -11 27 -2 Q29 12 16 15 Q2 12 0 0 Z";

function SnackLeaf({
  x,
  y,
  rotate,
  className,
}: {
  x: number;
  y: number;
  rotate: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <g className={className}>
        <path d={leafShape} fill="#7fae56" stroke="#665b50" strokeWidth="3" />
        <path
          d="M2 1 Q13 5 24 10"
          fill="none"
          stroke="#5d7d43"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

export function TongueCelebration({
  strokes,
  scene,
}: {
  strokes: Stroke[];
  scene: Scene;
}) {
  const [run, setRun] = useState(0);
  const lines = clipStrokes(strokes, scene);
  if (!lines.length) return null;
  const points = lines.flat();
  const tip = points.reduce((best, point) => (point.x > best.x ? point : best));
  const root = points.reduce((best, point) =>
    (point.x - mouth.x) ** 2 + (point.y - mouth.y) ** 2 <
    (best.x - mouth.x) ** 2 + (best.y - mouth.y) ** 2
      ? point
      : best,
  );
  const motionStyle = Object.fromEntries(
    leaves.map((leaf, index) => [
      `--bite-${index + 1}`,
      tongueBiteTransform(tip, leaf),
    ]),
  ) as CSSProperties;
  const height = scene.frameHeight || 400;
  return (
    <div className="tongue-party" data-testid="tongue-celebration">
      <svg
        key={run}
        className="tongue-party-stage"
        viewBox={`0 0 600 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <SceneBase scene={scene} completed />
        <g className="tongue-tree">
          <ellipse cx="547" cy="264" rx="48" ry="7" fill="#e7d9b8" />
          <path
            d="M539 262 C543 218 541 178 537 136 L553 136 C551 178 553 218 557 262 Z"
            fill="#c49a63"
            stroke="#665b50"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M545 172 Q516 150 490 146 M546 148 Q522 118 500 106"
            fill="none"
            stroke="#8a6b42"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <g fill="#8fbc63" stroke="#665b50" strokeWidth="3">
            <circle cx="492" cy="104" r="30" />
            <circle cx="566" cy="100" r="30" />
            <circle cx="530" cy="72" r="39" fill="#7fae56" />
            <circle cx="528" cy="118" r="35" />
            <circle cx="494" cy="134" r="23" fill="#7fae56" />
          </g>
          <path
            d="M500 128 Q480 158 467 184"
            fill="none"
            stroke="#8a6b42"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <SnackLeaf x={486} y={168} rotate={28} />
          <SnackLeaf x={472} y={152} rotate={-18} />
          <SnackLeaf
            x={leaves[0].x}
            y={leaves[0].y}
            rotate={-32}
            className="leaf-bite leaf-bite-1"
          />
          <SnackLeaf
            x={leaves[1].x}
            y={leaves[1].y}
            rotate={18}
            className="leaf-bite leaf-bite-2"
          />
          <SnackLeaf
            x={leaves[2].x}
            y={leaves[2].y}
            rotate={-64}
            className="leaf-bite leaf-bite-3"
          />
        </g>
        <g className="tongue-lines" style={motionStyle}>
          <path
            d={`M${mouth.x} ${mouth.y}L${root.x} ${root.y}`}
            fill="none"
            stroke="#277e78"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <SketchLines strokes={lines} />
        </g>
        <g className="party-sparkles" fill="#e9a13b">
          <path
            className="party-sparkle party-sparkle-1"
            d="M352 138 l3.5 8.5 8.5 3.5 -8.5 3.5 -3.5 8.5 -3.5 -8.5 -8.5 -3.5 8.5 -3.5 Z"
          />
          <path
            className="party-sparkle party-sparkle-2"
            d="M398 118 l2.8 6.8 6.8 2.8 -6.8 2.8 -2.8 6.8 -2.8 -6.8 -6.8 -2.8 6.8 -2.8 Z"
          />
        </g>
      </svg>
      <div className="tongue-party-bar">
        <p>描いた舌が、木の葉っぱを パクッ！</p>
        <button type="button" onClick={() => setRun((value) => value + 1)}>
          <Play size={15} aria-hidden="true" />
          もう一度見る
        </button>
      </div>
    </div>
  );
}
