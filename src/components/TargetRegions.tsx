import { motion } from "motion/react";
import type { Scene } from "../content/scenes";
// Guidance only. The actual clip remains shared by Canvas, judging and comparison.
export function TargetRegions({
  scene,
  reduce,
  displayScale = 1,
}: {
  scene: Scene;
  reduce: boolean;
  displayScale?: number;
}) {
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="drawing-target">
      {scene.regions.map((r, i) => (
        <motion.rect
          key={i}
          x={r.x * 600}
          y={r.y * (scene.frameHeight || 400)}
          width={r.width * 600}
          height={r.height * (scene.frameHeight || 400)}
          rx={Math.min(16, (r.height * (scene.frameHeight || 400)) / 3)}
          fill="#e8a04b"
          fillOpacity=".08"
          stroke="#d39142"
          strokeWidth={2 / displayScale}
          strokeDasharray="5 7"
          vectorEffect="non-scaling-stroke"
          initial={false}
          animate={{ opacity: reduce ? 0.8 : [0.35, 0.85, 0.35] }}
          transition={
            reduce ? { duration: 0 } : { duration: 2.8, repeat: Infinity }
          }
        />
      ))}
    </g>
  );
}
