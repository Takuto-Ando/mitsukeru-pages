import { useState, type CSSProperties } from "react";
import { Play } from "lucide-react";
import { clipStrokes, type Scene } from "../content/scenes";
import { celebrationFor } from "../content/celebrations";
import { SceneBase } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import type { Stroke } from "../types";
import "../styles/celebrations.css";

// 回転・拡縮の中心（シーン座標）。sway/curl/bounce は付け根＝領域の下端、
// それ以外は領域の中心を使う。
export function celebrationOrigin(
  scene: Scene,
  kind: string,
): { x: number; y: number } {
  const height = scene.frameHeight || 400;
  const region = scene.regions[0] ?? { x: 0.3, y: 0.3, width: 0.4, height: 0.4 };
  const pixelBased = region.width > 1 || region.height > 1;
  const x = pixelBased ? region.x : region.x * 600;
  const y = pixelBased ? region.y : region.y * height;
  const w = pixelBased ? region.width : region.width * 600;
  const h = pixelBased ? region.height : region.height * height;
  const bottomPivot = kind === "sway" || kind === "curl" || kind === "bounce";
  return {
    x: Math.round(x + w / 2),
    y: Math.round(bottomPivot ? y + h : y + h / 2),
  };
}

export function FeatureCelebration({
  strokes,
  scene,
  taskId,
}: {
  strokes: Stroke[];
  scene: Scene;
  taskId: string;
}) {
  const [run, setRun] = useState(0);
  const lines = clipStrokes(strokes, scene);
  if (!lines.length) return null;
  const celebration = celebrationFor(taskId);
  const origin = celebrationOrigin(scene, celebration.kind);
  const height = scene.frameHeight || 400;
  const motionStyle = {
    "--fx": `${origin.x}px`,
    "--fy": `${origin.y}px`,
  } as CSSProperties;
  return (
    <div className="feature-party" data-testid="feature-celebration">
      <svg
        key={run}
        className="feature-party-stage"
        viewBox={`0 0 600 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <SceneBase scene={scene} completed />
        <g
          className={`feature-lines feature-anim-${celebration.kind}`}
          style={motionStyle}
        >
          <SketchLines strokes={lines} />
        </g>
        <g fill="#e9a13b">
          <path
            className="feature-sparkle feature-sparkle-1"
            transform={`translate(${origin.x - 46} ${Math.max(8, origin.y - 64)})`}
            d="M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6 Z"
          />
          <path
            className="feature-sparkle feature-sparkle-2"
            transform={`translate(${origin.x + 40} ${Math.max(8, origin.y - 44)}) scale(0.7)`}
            d="M0 -9 L2.6 -2.6 L9 0 L2.6 2.6 L0 9 L-2.6 2.6 L-9 0 L-2.6 -2.6 Z"
          />
        </g>
      </svg>
      <div className="feature-party-bar">
        <p>{celebration.caption}</p>
        <button type="button" onClick={() => setRun((value) => value + 1)}>
          <Play size={15} aria-hidden="true" />
          もう一度見る
        </button>
      </div>
    </div>
  );
}
