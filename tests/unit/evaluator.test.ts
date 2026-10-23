import { expect, test } from "vitest";
import { evaluateObservation } from "../../src/evaluator";
const rect = (w: number, h: number) => [
  { x: 100, y: 100 },
  { x: 100 + w, y: 100 },
  { x: 100 + w, y: 100 + h },
  { x: 100, y: 100 + h },
  { x: 100, y: 100 },
];
const oval = (w: number, h: number) =>
  Array.from({ length: 101 }, (_, i) => ({
    x: 300 + (w / 2) * Math.cos((i / 100) * Math.PI * 2),
    y: 200 + (h / 2) * Math.sin((i / 100) * Math.PI * 2),
  }));
test.each([
  ["rectangle", [rect(300, 100)], "correct"],
  ["oval", [oval(300, 100)], "correct"],
  [
    "distorted",
    [
      [
        { x: 100, y: 100 },
        { x: 400, y: 120 },
        { x: 420, y: 200 },
        { x: 90, y: 190 },
        { x: 100, y: 100 },
      ],
    ],
    "correct",
  ],
  ["open", [rect(300, 100).slice(0, 4)], "correct"],
  ["overdrawn", [rect(300, 100), rect(300, 100)], "correct"],
  ["vertical rectangle", [rect(100, 300)], "retry"],
  ["vertical oval", [oval(100, 300)], "retry"],
  ["circle", [oval(200, 200)], "uncertain"],
  [
    "line",
    [
      [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    ],
    "uncertain",
  ],
  ["empty", [], "uncertain"],
] as const)("%s", (_, strokes, status) =>
  expect(
    evaluateObservation(strokes.map((s) => s.map((p) => ({ ...p })))).status,
  ).toBe(status),
);
test("isolated stray point does not dominate", () =>
  expect(
    evaluateObservation([rect(300, 100), [{ x: 590, y: 390 }]]).status,
  ).toBe("correct"));

test("課題ごとに閾値を変えられる", () => {
  const strokes = [rect(140, 100)];
  expect(evaluateObservation(strokes).status).toBe("correct");
  expect(
    evaluateObservation(strokes, {
      minAspect: 1.5,
      verticalAspect: 0.85,
      trim: 0.05,
      minHeight: 8,
      minWidth: 18,
    }).status,
  ).toBe("uncertain");
});
