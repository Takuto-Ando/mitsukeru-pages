import type { Scene } from "../content/scenes";
import { EyeOutline } from "../Illustrations";
export function SceneRegions({ scene }: { scene: Scene }) {
  return (
    <>
      {scene.regions.map((r, i) => (
        <rect
          key={i}
          x={r.x * 600}
          y={r.y * 400}
          width={r.width * 600}
          height={r.height * 400}
        />
      ))}
    </>
  );
}
export function SceneBase({
  scene,
  completed = false,
}: {
  scene: Scene;
  completed?: boolean;
}) {
  return (
    <g data-testid="animal-background">
      {scene.photo ? (
        <image
          href={import.meta.env.BASE_URL + scene.photo}
          width="600"
          height="400"
          preserveAspectRatio="none"
        />
      ) : scene.background ? (
        <path
          d={scene.background}
          fill="#f2dfbd"
          stroke="#746452"
          strokeWidth="4"
        />
      ) : (
        <EyeOutline />
      )}
      {(!completed || scene.photo) && (
        <g fill="#fffef8" data-testid="blank-regions">
          <SceneRegions scene={scene} />
        </g>
      )}
    </g>
  );
}
