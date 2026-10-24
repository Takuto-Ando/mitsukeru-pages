import { useId } from "react";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import { clipStrokes, type Scene } from "../content/scenes";
import type { Stroke } from "../types";
export function DrawingOverview({
  scene,
  strokes,
}: {
  scene: Scene;
  strokes: Stroke[];
}) {
  const clip = useId();
  return (
    <div className="drawing-overview" data-testid="drawing-overview">
      <svg
        viewBox={`0 0 600 ${scene.frameHeight || 400}`}
        role="img"
        aria-label="動物全体と描いている場所"
      >
        <defs>
          <clipPath id={clip}>
            <SceneRegions scene={scene} />
          </clipPath>
        </defs>
        <SceneBase scene={scene} />
        <g clipPath={`url(#${clip})`}>
          <SketchLines strokes={clipStrokes(strokes, scene)} />
        </g>
        <g fill="none" stroke="#df8d45" strokeWidth="8">
          <SceneRegions scene={scene} />
        </g>
      </svg>
      <span>全体のようす</span>
    </div>
  );
}
