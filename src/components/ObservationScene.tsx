import { artwork, assetPath } from "../content/artwork";
import { drawingRegions, type Scene } from "../content/scenes";
import { EyeOutline } from "../Illustrations";
export function SceneRegions({ scene }: { scene: Scene }) {
  return (
    <>
      {drawingRegions(scene).map((r, i) => (
        <rect
          key={i}
          x={r.x * 600}
          y={r.y * (scene.frameHeight || 400)}
          width={r.width * 600}
          height={r.height * (scene.frameHeight || 400)}
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
  const art = scene.artworkOverride || artwork[scene.id];
  const asset = completed
    ? art?.completedBase || art?.incomplete
    : art?.incomplete;
  return (
    <g data-testid="animal-background">
      {asset ? (
        <image
          href={assetPath(asset)}
          width="600"
          height={scene.frameHeight || 400}
          preserveAspectRatio="none"
        />
      ) : scene.photo ? (
        <image
          href={import.meta.env.BASE_URL + scene.photo}
          width="600"
          height={scene.frameHeight || 400}
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
      {(art?.maskInApp ||
        !completed ||
        scene.photo ||
        (asset && !art?.completedBase)) && (
        <g fill={art?.blankFill || "#fffef8"} data-testid="blank-regions">
          <SceneRegions scene={scene} />
        </g>
      )}
    </g>
  );
}
