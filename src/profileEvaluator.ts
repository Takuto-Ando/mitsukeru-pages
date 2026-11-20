import type { Stroke, Point, Evaluation } from "./types";
import type { Scene } from "./content/scenes";
import { featureCues } from "./content/featureCues";
export interface FeatureRule {
  kind:
    | "paired-bands"
    | "paired-reach"
    | "paired-patches"
    | "trunk"
    | "curl"
    | "hoof"
    | "tongue"
    | "nostrils"
    | "paw"
    | "crest"
    | "cross";
  minWidth: number;
  minHeight: number;
  minTurn?: number;
}
export const featureRules: Record<string, FeatureRule> = {
  mandrill: { kind: "paired-bands", minWidth: 0, minHeight: 45 },
  gibbon: { kind: "paired-reach", minWidth: 12, minHeight: 55 },
  lemur: { kind: "paired-patches", minWidth: 22, minHeight: 20 },
  elephant: { kind: "trunk", minWidth: 10, minHeight: 75 },
  capuchin: { kind: "curl", minWidth: 45, minHeight: 45, minTurn: 1.4 },
  macaque: { kind: "paired-patches", minWidth: 30, minHeight: 35 },
  badger: { kind: "paired-bands", minWidth: 0, minHeight: 65 },
  zebra: { kind: "hoof", minTurn: 0.6, minWidth: 65, minHeight: 40 },
  giraffe: { kind: "tongue", minWidth: 28, minHeight: 35, minTurn: 0.8 },
  hippo: { kind: "nostrils", minWidth: 12, minHeight: 8 },
  fennec: { kind: "paw", minTurn: 0.6, minWidth: 65, minHeight: 45 },
  gorilla: { kind: "crest", minTurn: 0.5, minWidth: 100, minHeight: 35 },
  donkey: { kind: "cross", minWidth: 110, minHeight: 65 },
  meerkat: { kind: "paired-patches", minWidth: 25, minHeight: 12 },
};
function samples(strokes: Stroke[]) {
  const map = new Map<string, Point>();
  for (const s of strokes)
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1],
        b = s[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let j = 0; j <= n; j++) {
        const p = {
          x: a.x + ((b.x - a.x) * j) / n,
          y: a.y + ((b.y - a.y) * j) / n,
        };
        if (Number.isFinite(p.x) && Number.isFinite(p.y))
          map.set(`${Math.round(p.x / 4)},${Math.round(p.y / 4)}`, p);
      }
    }
  return [...map.values()];
}
function spans(points: Point[]) {
  const extent = (axis: "x" | "y") => {
    const v = points.map((p) => p[axis]).sort((a, b) => a - b);
    return v.length
      ? v[Math.floor((v.length - 1) * 0.97)] -
          v[Math.floor((v.length - 1) * 0.03)]
      : 0;
  };
  return { width: extent("x"), height: extent("y") };
}
export function hasFeatureRule(id: string): boolean {
  return Object.hasOwn(featureCues, id) || Object.hasOwn(featureRules, id);
}

function directions(strokes: Stroke[]) {
  let turn = 0,
    horizontal = 0,
    vertical = 0;
  for (const s of strokes) {
    let before: Point | undefined, angle: number | undefined;
    for (const p of s) {
      if (!before) {
        before = p;
        continue;
      }
      const dx = p.x - before.x,
        dy = p.y - before.y,
        len = Math.hypot(dx, dy);
      if (len < 9) continue;
      const a = Math.atan2(dy, dx);
      if (angle !== undefined)
        turn += Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
      if (Math.abs(dx) > Math.abs(dy) * 1.6) horizontal += len;
      if (Math.abs(dy) > Math.abs(dx) * 1.6) vertical += len;
      before = p;
      angle = a;
    }
  }
  return { turn, horizontal, vertical };
}

function separatedMarks(
  strokes: Stroke[],
  cue: Extract<NonNullable<(typeof featureCues)[string]>, { kind: "marks" }>,
) {
  const positions: number[] = [];
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const p of stroke) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    const width = x1 - x0,
      height = y1 - y0;
    if (cue.direction === "up" && (height < cue.size || height < width * 0.75))
      continue;
    if (
      cue.direction === "across" &&
      (width < cue.size || width < height * 0.7)
    )
      continue;
    if (!cue.direction && Math.max(width, height) < cue.size) continue;
    positions.push(cue.axis === "x" ? (x0 + x1) / 2 : (y0 + y1) / 2);
  }
  let previous = -Infinity;
  let count = 0;
  for (const position of positions.sort((a, b) => a - b)) {
    if (position - previous < cue.separation) continue;
    previous = position;
    if (++count >= cue.count) return true;
  }
  return false;
}

function matchesCue(
  strokes: Stroke[],
  cue: NonNullable<(typeof featureCues)[string]>,
): boolean {
  if (cue.kind === "marks") return separatedMarks(strokes, cue);
  const points = samples(strokes);
  const extent = spans(points);
  if (extent.width < cue.width || extent.height < cue.height) return false;
  if (cue.kind === "bend") return directions(strokes).turn >= cue.minTurn;

  // Compare the center edge with the two sides, irrespective of order
  // or whether the observer drew the rest of the outline.
  const xs = points.map((point) => point.x).sort((a, b) => a - b);
  const left = xs[Math.floor((xs.length - 1) * 0.03)];
  const middle =
    cue.edge === "top"
      ? [0.47, 0.5, 0.53]
      : [0.44, 0.47, 0.5, 0.53, 0.56, 0.59, 0.62];
  const halfWindow = cue.edge === "top" ? 0.09 : 0.028;
  const centerEdges = middle.map(() => Infinity);
  let leftEdge = Infinity;
  let rightEdge = Infinity;
  for (const point of points) {
    const x = (point.x - left) / extent.width;
    const y = cue.edge === "top" ? point.y : -point.y;
    if (x < 0.35) leftEdge = Math.min(leftEdge, y);
    if (x > 0.65) rightEdge = Math.min(rightEdge, y);
    for (const [index, center] of middle.entries())
      if (Math.abs(x - center) <= halfWindow)
        centerEdges[index] = Math.min(centerEdges[index], y);
  }
  return centerEdges.some(
    (edge) =>
      Number.isFinite(edge) &&
      edge >= Math.max(leftEdge, rightEdge) + cue.depth,
  );
}

export function evaluateFeatures(
  strokes: Stroke[],
  scene: Scene,
  hint: string,
): Evaluation {
  const rule = featureRules[scene.id];
  const cue =
    scene.id === "elephant" && scene.frameHeight !== 600
      ? undefined
      : featureCues[scene.id];
  if (!cue && !rule)
    return {
      passed: false,
      status: "uncertain",
      message: "見えた形を見くらべよう。",
      suggestion: hint,
    };
  const points = samples(strokes);
  const { width, height } = spans(points);
  const { turn, horizontal, vertical } = directions(strokes);
  if (cue) {
    const fits =
      "eachRegion" in cue && cue.eachRegion
        ? scene.regions.every((region) =>
            matchesCue(
              strokes.filter(([point]) => {
                if (!point) return false;
                const x = point.x / 600;
                const y = point.y / (scene.frameHeight || 400);
                return (
                  x >= region.x - 1e-6 &&
                  x <= region.x + region.width + 1e-6 &&
                  y >= region.y - 1e-6 &&
                  y <= region.y + region.height + 1e-6
                );
              }),
              cue,
            ),
          )
        : matchesCue(strokes, cue);
    return {
      status: fits ? "correct" : "uncertain",
      passed: fits,
      message: fits ? "特徴を見つけたね！" : "実物でも、こんな形に見えた？",
      suggestion: fits ? "" : hint,
      debug: {
        cue: cue.kind,
        width,
        height,
        turn,
        horizontal,
        vertical,
        strokes: strokes.length,
        automaticJudging: "feature-heuristic",
      },
    };
  }
  const regions = scene.regions.map((r) =>
    spans(
      points.filter(
        (p) =>
          p.x >= r.x * 600 &&
          p.x <= (r.x + r.width) * 600 &&
          p.y >= r.y * (scene.frameHeight || 400) &&
          p.y <= (r.y + r.height) * (scene.frameHeight || 400),
      ),
    ),
  );
  let fits = false;
  if (rule.kind.startsWith("paired") || rule.kind === "nostrils")
    fits = regions.every(
      (s) => s.width >= rule.minWidth && s.height >= rule.minHeight,
    );
  else if (rule.kind === "cross")
    fits = horizontal >= rule.minWidth && vertical >= rule.minHeight;
  else
    fits =
      width >= rule.minWidth &&
      height >= rule.minHeight &&
      (!rule.minTurn || turn >= rule.minTurn);
  const status: "correct" | "uncertain" | "retry" = !points.length
    ? "uncertain"
    : fits
      ? "correct"
      : Math.max(width, height) > 40 &&
          ((rule.kind === "crest" && height > width * 1.7) ||
            (rule.kind === "trunk" && width > height * 2))
        ? "retry"
        : "uncertain";
  return {
    status,
    passed: status === "correct",
    message:
      status === "correct"
        ? "特徴を見つけたね！"
        : status === "retry"
          ? "実物の形を、もう一度見てみよう。"
          : "実物でも、こんな形に見えた？",
    suggestion: status === "correct" ? "" : hint,
    debug: {
      cue: rule.kind,
      width,
      height,
      strokes: strokes.length,
      automaticJudging: "feature-heuristic",
      turn,
      horizontal,
      vertical,
      regions,
    },
  };
}
