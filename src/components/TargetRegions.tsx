import type { Scene } from "../content/scenes";

export function TargetRegions({ scene }: { scene: Scene }) {
  const height = scene.frameHeight || 400;
  return (
    <g
      className="drawing-target"
      aria-hidden="true"
      pointerEvents="none"
      data-testid="drawing-target"
      fill="none"
      stroke="#bdbab4"
      strokeWidth="2"
      strokeDasharray="4 5"
    >
      {scene.id === "giraffe" && scene.answerPath ? (
        <path d={scene.answerPath} vectorEffect="non-scaling-stroke" />
      ) : (
        scene.regions.map((region, index) => (
          <rect
            key={index}
            x={region.x * 600}
            y={region.y * height}
            width={region.width * 600}
            height={region.height * height}
            rx="6"
            vectorEffect="non-scaling-stroke"
          />
        ))
      )}
    </g>
  );
}
