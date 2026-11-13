import { test, expect } from "vitest";
import { tongueBiteTransform } from "../../src/components/TongueCelebration";

test("描いた舌の先端は、描画位置が違っても葉に届き、口元は動かない", () => {
  const mouth = { x: 330, y: 188 };
  const leaves = [
    { x: 458, y: 190 },
    { x: 480, y: 207 },
    { x: 449, y: 215 },
  ];
  for (const tip of [
    { x: 500, y: 215 },
    { x: 430, y: 350 },
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
