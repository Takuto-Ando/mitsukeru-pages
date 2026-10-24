import { test, expect } from "vitest";
import { profiles, evaluateProfile } from "../../src/content/profiles";
import { scenes, clipStrokes } from "../../src/content/scenes";
import { featureRules } from "../../src/profileEvaluator";
import type { Stroke } from "../../src/types";
const rect = (x: number, y: number, w: number, h: number): Stroke => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
  { x, y },
];
const oval = (x: number, y: number, w: number, h: number): Stroke =>
  Array.from({ length: 80 }, (_, i) => ({
    x: x + (Math.cos((i / 79) * Math.PI * 2) * w) / 2,
    y: y + (Math.sin((i / 79) * Math.PI * 2) * h) / 2,
  }));
for (const [id, p] of Object.entries(profiles)) {
  test(`${id}: 特徴を捉えた形を正解にする`, () => {
    const scene = scenes[id],
      r = scene.regions[0],
      rule = featureRules[id];
    let strokes: Stroke[] = [];
    if (rule.kind.startsWith("paired") || rule.kind === "nostrils")
      strokes = scene.regions.map((r) =>
        rect(
          r.x * 600 + 5,
          r.y * 400 + 5,
          r.width * 600 - 10,
          r.height * 400 - 10,
        ),
      );
    else if (id === "donkey")
      strokes = [
        [
          { x: 150, y: 225 },
          { x: 450, y: 225 },
        ],
        [
          { x: 225, y: 140 },
          { x: 225, y: 300 },
        ],
      ];
    else if (id === "deer")
      strokes = [
        oval(200, 200, 12, 12),
        oval(270, 230, 12, 12),
        oval(360, 190, 12, 12),
      ];
    else if (rule.minTurn)
      strokes = [
        oval(
          (r.x + r.width / 2) * 600,
          (r.y + r.height / 2) * 400,
          r.width * 600 * 0.8,
          r.height * 400 * 0.8,
        ),
      ];
    else
      strokes = [
        rect(
          r.x * 600 + 8,
          r.y * 400 + 8,
          r.width * 600 - 16,
          r.height * 400 - 16,
        ),
      ];
    const result = evaluateProfile(clipStrokes(strokes, scene), p, scene);
    expect(result.status).toBe("correct");
    expect(result.debug?.automaticJudging).toBe("feature-heuristic");
  });
  test(`${id}: 空白や小さな落書きは即正解にしない`, () => {
    const r = scenes[id].regions[0],
      x = r.x * 600 + 10,
      y = r.y * 400 + 10;
    expect(evaluateProfile([], p, scenes[id]).status).toBe("uncertain");
    expect(evaluateProfile([rect(x, y, 2, 2)], p, scenes[id]).passed).toBe(
      false,
    );
  });
}
test("ゾウの横線とゴリラの縦線は再観察", () => {
  expect(
    evaluateProfile(
      [
        [
          { x: 250, y: 200 },
          { x: 380, y: 200 },
        ],
      ],
      profiles.elephant,
      scenes.elephant,
    ).status,
  ).toBe("retry");
  expect(
    evaluateProfile(
      [
        [
          { x: 300, y: 50 },
          { x: 300, y: 180 },
        ],
      ],
      profiles.gorilla,
      scenes.gorilla,
    ).status,
  ).toBe("retry");
});
test("お手本は動物ごとに異なる", () =>
  expect(new Set(Object.values(profiles).map((p) => p.answer)).size).toBe(15));

for (const [id, p] of Object.entries(profiles))
  test(`${id}: 一本の横線だけを正解にしない`, () => {
    const r = scenes[id].regions[0],
      y = (r.y + r.height / 2) * 400;
    expect(
      evaluateProfile(
        [
          [
            { x: 0, y },
            { x: 600, y },
          ],
        ],
        p,
        scenes[id],
      ).passed,
    ).toBe(false);
  });

import { taskById } from "../../src/content/tasks";
for (const id of ["gibbon", "hippo"]) {
  test(`${id}: 全身座標でも各領域内の特徴を評価する`, () => {
    const scene = taskById[id].scene;
    const strokes = scene.regions.map((r) =>
      rect(
        r.x * 600 + 5,
        r.y * 600 + 5,
        r.width * 600 - 10,
        r.height * 600 - 10,
      ),
    );
    expect(
      evaluateProfile(clipStrokes(strokes, scene), profiles[id], scene).status,
    ).toBe("correct");
  });
}
