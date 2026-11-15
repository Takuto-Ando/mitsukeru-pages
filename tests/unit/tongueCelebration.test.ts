import { test, expect } from "vitest";
import { tongueBiteTransform } from "../../src/components/TongueCelebration";

test("描いた舌の先端は、描画位置が違っても葉に届き、口元は動かない", () => {
  const mouth = { x: 326, y: 305 };
  const leaves = [
    { x: 500, y: 285 },
    { x: 523, y: 301 },
    { x: 488, y: 312 },
  ];
  for (const tip of [
    { x: 535, y: 290 },
    { x: 435, y: 345 },
  ]) {
    for (const leaf of leaves) {
      const values = tongueBiteTransform(tip, leaf)
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number);
      const [a, b, c, d, e, f] = values;
      expect(a * tip.x + c * tip.y + e).toBeCloseTo(leaf.x);
      expect(b * tip.x + d * tip.y + f).toBeCloseTo(leaf.y);
      expect(a * mouth.x + c * mouth.y + e).toBeCloseTo(mouth.x);
      expect(b * mouth.x + d * mouth.y + f).toBeCloseTo(mouth.y);
    }
  }
});
