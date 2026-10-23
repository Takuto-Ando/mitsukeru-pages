import { test, expect } from "vitest";
import { scenes, clipStrokes, scenePoint } from "../../src/content/scenes";
import { evaluateObservation } from "../../src/evaluator";
test("全16課題が異なる正規化マスクを持つ", () => {
  expect(Object.keys(scenes)).toHaveLength(16);
  expect(
    new Set(Object.values(scenes).map((s) => JSON.stringify(s.regions))).size,
  ).toBe(16);
  for (const s of Object.values(scenes))
    for (const r of s.regions) {
      expect(
        r.x >= 0 && r.y >= 0 && r.x + r.width <= 1 && r.y + r.height <= 1,
      ).toBe(true);
    }
});
test("空白の外は回答にならない", () =>
  expect(
    clipStrokes(
      [
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      ],
      scenes.goat,
    ),
  ).toEqual([]));
test("はみ出した横長輪郭も可視部分で正解になり元データは不変", () => {
  const strokes = [
    [
      { x: 170, y: 185 },
      { x: 450, y: 185 },
      { x: 450, y: 250 },
      { x: 170, y: 250 },
      { x: 170, y: 185 },
    ],
  ];
  const original = JSON.stringify(strokes);
  const clipped = clipStrokes(strokes, scenes.goat);
  expect(evaluateObservation(clipped).status).toBe("correct");
  expect(JSON.stringify(strokes)).toBe(original);
  for (const p of clipped.flat())
    expect(p.x >= 190 && p.x <= 420 && p.y >= 165 && p.y <= 275).toBe(true);
});
test("複数領域間に線を橋渡ししない", () => {
  const clipped = clipStrokes(
    [
      [
        { x: 150, y: 190 },
        { x: 450, y: 190 },
      ],
    ],
    scenes.hippo,
  );
  expect(clipped).toHaveLength(2);
});
test("画面幅が変わっても正規化位置は同じ", () =>
  expect(scenePoint(50, 25, 100, 50)).toEqual(scenePoint(150, 75, 300, 150)));

test("保護した目の上だけに描いた線は可視描画にならない", () => {
  const scene = {
    ...scenes.goat,
    maskHoles: [{ x: 0.4, y: 0.5, width: 0.1, height: 0.1 }],
  };
  expect(
    clipStrokes(
      [
        [
          { x: 250, y: 210 },
          { x: 280, y: 225 },
        ],
      ],
      scene,
    ),
  ).toEqual([]);
});
