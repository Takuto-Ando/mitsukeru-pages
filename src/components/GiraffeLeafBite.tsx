import type { CSSProperties, ReactNode } from "react";
import { assetPath } from "../content/artwork";
import { getStrokeStyle } from "../drawing/styles";
import type { Point, Stroke } from "../types";
import { tongueBiteTransform } from "./TongueCelebration";

// Coordinates within the Figma branch group, mapped to the drawing's scene.
const branch = { x: 440, y: 8, width: 126 * 1.36, height: 205 * 1.26 };
const mouth = { x: 326, y: 305 };
const leaves = [
  { asset: "giraffe-result-leaf.svg", x: 49.5, y: 184, rx: 13, ry: 19 },
  { asset: "giraffe-result-leaf-2.svg", x: 70, y: 171, rx: 16, ry: 19 },
] as const;

type TongueTip = Point & { color: string; width: number };

export function giraffeTongueTip(strokes: Stroke[]): TongueTip | undefined {
  let tip: Point | undefined;
  let tipStroke: Stroke | undefined;
  for (const stroke of strokes) {
    for (const point of stroke) {
      if (!tip || point.x > tip.x) {
        tip = point;
        tipStroke = stroke;
      }
    }
  }
  if (!tip || !tipStroke || Math.hypot(tip.x - mouth.x, tip.y - mouth.y) < 12)
    return undefined;
  const style = getStrokeStyle(tipStroke);
  return { ...tip, color: style?.color ?? "#277e78", width: style?.width ?? 7 };
}

function leafBite(tip: TongueTip, leaf: (typeof leaves)[number]) {
  const center = { x: branch.x + leaf.x * 1.36, y: branch.y + leaf.y * 1.26 };
  const rx = leaf.rx * 1.36;
  const ry = leaf.ry * 1.26;
  // The curl is a short continuation of the child's line. Its start and
  // the tongue's tip share the same coordinates during the entire pull.
  const grip = { x: center.x - rx / 2, y: center.y + ry * 0.866 };
  const dx = mouth.x - center.x;
  const dy = mouth.y - center.y;
  const end = { x: grip.x + dx, y: grip.y + dy };
  const strokeScale =
    Math.hypot(grip.x - mouth.x, grip.y - mouth.y) /
    Math.hypot(tip.x - mouth.x, tip.y - mouth.y);
  return {
    asset: leaf.asset,
    reach: tongueBiteTransform(tip, grip),
    tuck: tongueBiteTransform(tip, end),
    travel: { "--leaf-travel-x": `${dx}px`, "--leaf-travel-y": `${dy}px` },
    curl: `M ${grip.x} ${grip.y} A ${rx} ${ry} 0 1 1 ${center.x + rx * 0.8} ${center.y + ry * 0.6} Q ${center.x + rx * 0.35} ${center.y + ry} ${center.x} ${center.y + ry * 0.5}`,
    width: Math.min(16, tip.width * strokeScale),
  };
}

export function GiraffeLeafBite({
  tip,
  children,
}: {
  tip: TongueTip;
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
      <g className="giraffe-result-tongue">{children}</g>
      {bites.map((bite, index) => (
        <g
          key={bite.asset}
          className="giraffe-result-grip"
          data-bite={index + 1}
          style={bite.travel as CSSProperties}
          aria-hidden="true"
        >
          <path
            className="giraffe-result-curl"
            d={bite.curl}
            pathLength="1"
            fill="none"
            stroke={tip.color}
            strokeWidth={bite.width}
            strokeLinecap="round"
            strokeDasharray="1"
            strokeDashoffset="1"
          />
        </g>
      ))}
    </g>
  );
}
