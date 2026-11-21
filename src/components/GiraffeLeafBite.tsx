import type { CSSProperties, ReactNode } from "react";
import { assetPath } from "../content/artwork";
import type { Point, Stroke } from "../types";
import { tongueBiteTransform } from "./TongueCelebration";

// The branch has its own Figma vector group. Position it in the same 600px
// scene as the ink and animate its lowest leaf separately from the branch.
const branch = { x: 440, y: 8, width: 126 * 1.36, height: 205 * 1.26 };
const leaf = { x: branch.x + 50 * 1.36, y: branch.y + 187 * 1.26 };
const mouth = { x: 326, y: 305 };

export function giraffeTongueTip(strokes: Stroke[]): Point | undefined {
  let tip: Point | undefined;
  for (const stroke of strokes) {
    for (const point of stroke) {
      if (!tip || point.x > tip.x) tip = point;
    }
  }
  return tip && Math.hypot(tip.x - mouth.x, tip.y - mouth.y) >= 12
    ? tip
    : undefined;
}

export function GiraffeLeafBite({
  tip,
  children,
}: {
  tip: Point;
  children: ReactNode;
}) {
  const motionStyle = {
    "--tongue-reach": tongueBiteTransform(tip, leaf),
    "--tongue-tuck": tongueBiteTransform(tip, { x: mouth.x + 12, y: mouth.y }),
    "--leaf-travel-x": `${mouth.x - leaf.x}px`,
    "--leaf-travel-y": `${mouth.y - leaf.y}px`,
  } as CSSProperties;
  return (
    <g data-testid="giraffe-leaf-bite" style={motionStyle}>
      <g className="giraffe-result-branch" aria-hidden="true">
        <image
          href={assetPath("illustrations/pdf-design/giraffe-result-branch.svg")}
          {...branch}
          preserveAspectRatio="none"
        />
        <image
          className="giraffe-result-leaf"
          href={assetPath("illustrations/pdf-design/giraffe-result-leaf.svg")}
          {...branch}
          preserveAspectRatio="none"
        />
      </g>
      <g className="giraffe-result-tongue">{children}</g>
    </g>
  );
}
