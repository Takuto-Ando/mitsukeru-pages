import type { Stroke, Point, Evaluation } from "./types";
import type { Scene } from "./content/scenes";
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
    | "cross"
    | "spots";
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
  deer: { kind: "spots", minWidth: 40, minHeight: 0 },
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
export function evaluateFeatures(
  strokes: Stroke[],
  scene: Scene,
  hint: string,
): Evaluation {
  const rule = featureRules[scene.id],
    points = samples(strokes),
    { width, height } = spans(points);
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
  const regions = scene.regions.map((r) =>
    spans(
      points.filter(
        (p) =>
          p.x >= r.x * 600 &&
          p.x <= (r.x + r.width) * 600 &&
          p.y >= r.y * 400 &&
          p.y <= (r.y + r.height) * 400,
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
  else if (rule.kind === "spots") {
    // Separated marks, independent of pen speed and exact circle shape.
    const remaining = [...points];
    let clusters = 0;
    while (remaining.length) {
      const pending = [remaining.pop()!];
      let size = 0;
      while (pending.length) {
        const a = pending.pop()!;
        size++;
        for (let i = remaining.length - 1; i >= 0; i--)
          if (Math.hypot(a.x - remaining[i].x, a.y - remaining[i].y) < 18)
            pending.push(remaining.splice(i, 1)[0]);
      }
      if (size >= 2) clusters++;
    }
    fits = clusters >= 3 && width >= rule.minWidth;
  } else
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
