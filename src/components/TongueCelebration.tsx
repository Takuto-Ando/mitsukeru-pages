import { useState } from "react";
import { Play } from "lucide-react";
import { clipStrokes, type Scene } from "../content/scenes";
import { SceneBase } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import type { Stroke } from "../types";

// Celebration for the giraffe tongue task (600x600 whole-animal frame):
// a tree pops up at the top right, then the child's own tongue strokes
// stretch out and munch the three hanging leaves, one bite at a time.
// Timings are fractions of one run and must match the CSS keyframes in
// styles/cards.css (.tongue-tree / .tongue-lines / .leaf-bite-*).
export const tonguePartyLayout = {
  durationMs: 5000,
  // Mouth edge of the tongue window; the tongue stretches from here.
  mouth: { x: 330, y: 188 },
  // The tree stands in the empty sky at the top right of the frame.
  treeBase: { x: 547, y: 262 },
  bites: [
    { leaf: { x: 458, y: 190 }, at: 0.21 },
    { leaf: { x: 480, y: 207 }, at: 0.35 },
    { leaf: { x: 449, y: 215 }, at: 0.49 },
  ],
} as const;

const leafShape =
  "M0 0 Q13 -11 27 -2 Q29 12 16 15 Q2 12 0 0 Z";

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
            x={tonguePartyLayout.bites[0].leaf.x}
            y={tonguePartyLayout.bites[0].leaf.y}
            rotate={-32}
            className="leaf-bite leaf-bite-1"
          />
          <SnackLeaf
            x={tonguePartyLayout.bites[1].leaf.x}
            y={tonguePartyLayout.bites[1].leaf.y}
            rotate={18}
            className="leaf-bite leaf-bite-2"
          />
          <SnackLeaf
            x={tonguePartyLayout.bites[2].leaf.x}
            y={tonguePartyLayout.bites[2].leaf.y}
            rotate={-64}
            className="leaf-bite leaf-bite-3"
          />
        </g>
        <g className="tongue-lines">
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
