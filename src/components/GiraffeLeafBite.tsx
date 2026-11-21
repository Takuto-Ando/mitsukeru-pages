import type { CSSProperties, ReactNode } from "react";
import { assetPath } from "../content/artwork";
import type { Point, Stroke } from "../types";
import { tongueBiteTransform } from "./TongueCelebration";

// Coordinates within the Figma branch group, mapped to the drawing's scene.
const branch = { x: 440, y: 8, width: 126 * 1.36, height: 205 * 1.26 };
const mouth = { x: 326, y: 305 };
const leaves = [
  { asset: "giraffe-result-leaf.svg", x: 49.5, y: 184 },
  { asset: "giraffe-result-leaf-2.svg", x: 70, y: 171 },
] as const;

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

function leafBite(tip: Point, leaf: (typeof leaves)[number]) {
  const center = { x: branch.x + leaf.x * 1.36, y: branch.y + leaf.y * 1.26 };
  return {
    asset: leaf.asset,
    reach: tongueBiteTransform(tip, center),
    // Keep the line near the mouth during the leaf's final few pixels of travel.
    tuck: tongueBiteTransform(tip, { x: mouth.x + 8, y: mouth.y }),
    travel: {
      "--leaf-travel-x": `${mouth.x + 8 - center.x}px`,
      "--leaf-travel-y": `${mouth.y - center.y}px`,
    },
  };
}

export function GiraffeLeafBite({
  tip,
  children,
}: {
  tip: Point;
  children: ReactNode;
}) {
  const bites = leaves.map((leaf) => leafBite(tip, leaf));
  const motionStyle = {
    "--tongue-reach-first": bites[0].reach,
    "--tongue-tuck-first": bites[0].tuck,
    "--tongue-reach-second": bites[1].reach,
    "--tongue-tuck-second": bites[1].tuck,
  } as CSSProperties;

  return (
    <g data-testid="giraffe-leaf-bite" style={motionStyle}>
      <g className="giraffe-result-tongue">{children}</g>
      <g className="giraffe-result-branch" aria-hidden="true">
        <image
          href={assetPath("illustrations/pdf-design/giraffe-result-branch.svg")}
          {...branch}
          preserveAspectRatio="none"
        />
        {bites.map((bite, index) => (
          <image
            key={bite.asset}
            className="giraffe-result-leaf"
            data-bite={index + 1}
            style={bite.travel as CSSProperties}
            href={assetPath(`illustrations/pdf-design/${bite.asset}`)}
            {...branch}
            preserveAspectRatio="none"
          />
        ))}
      </g>
    </g>
  );
}
