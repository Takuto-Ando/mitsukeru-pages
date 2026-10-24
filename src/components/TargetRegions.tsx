import type { Scene } from "../content/scenes";
// A printed guide, not an animation. Drawing masks remain shared with judging.
export function TargetRegions({ scene }: { scene: Scene }) {
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="drawing-target">
      {scene.regions.map((r, i) => (
        <rect
          key={i}
          x={r.x * 600}
          y={r.y * (scene.frameHeight || 400)}
          width={r.width * 600}
          height={r.height * (scene.frameHeight || 400)}
          rx="3"
          fill="#c6a353"
          fillOpacity=".07"
          stroke="#a88439"
          strokeWidth="1.2"
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
