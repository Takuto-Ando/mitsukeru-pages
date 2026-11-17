import { test, expect } from "vitest";
import { eraseStrokes } from "../../src/drawing/erase";
import type { Stroke } from "../../src/types";

const line = (x1: number, y: number, x2: number): Stroke => [
  { x: x1, y },
  { x: x2, y },
];

test("円に触れない線はそのまま残り、変更なしになる", () => {
  const strokes = [line(100, 100, 200)];
  const result = eraseStrokes(strokes, { x: 400, y: 400 }, 20);
  expect(result.changed).toBe(false);
  expect(result.strokes[0]).toBe(strokes[0]);
});

test("円の中だけが切り取られ、線が2つに分かれる", () => {
  const result = eraseStrokes([line(100, 100, 300)], { x: 200, y: 100 }, 30);
  expect(result.changed).toBe(true);
  expect(result.strokes).toHaveLength(2);
  for (const part of result.strokes)
    for (const point of part)
      expect(Math.hypot(point.x - 200, point.y - 100)).toBeGreaterThanOrEqual(29);
  expect(result.strokes[0].at(-1)!.x).toBeLessThan(200);
  expect(result.strokes[1][0].x).toBeGreaterThan(200);
});

test("全部が円の中にある線は消える", () => {
  const result = eraseStrokes([line(180, 100, 220)], { x: 200, y: 100 }, 30);
  expect(result.changed).toBe(true);
  expect(result.strokes).toEqual([]);
});

test("点だけの筆跡も円の中なら消え、外なら残る", () => {
  const dot: Stroke = [{ x: 200, y: 100 }];
  expect(eraseStrokes([dot], { x: 200, y: 100 }, 30).strokes).toEqual([]);
  const kept = eraseStrokes([dot], { x: 400, y: 400 }, 30);
  expect(kept.changed).toBe(false);
  expect(kept.strokes[0]).toBe(dot);
});

test("点の少ない速い線でも、区間の途中が消える", () => {
  // Two sampled points 200 units apart: without subdivision the segment
  // midpoint would never be classified as inside.
  const result = eraseStrokes([line(100, 100, 300)], { x: 200, y: 100 }, 25);
  expect(result.strokes).toHaveLength(2);
});

test("分割された線に元の線へのコールバックが届く", () => {
  const original = line(100, 100, 300);
  const seen: Array<{ original: Stroke; parts: Stroke[] }> = [];
  eraseStrokes([original], { x: 200, y: 100 }, 30, (o, parts) =>
    seen.push({ original: o, parts }),
  );
  expect(seen).toHaveLength(1);
  expect(seen[0].original).toBe(original);
  expect(seen[0].parts).toHaveLength(2);
});
