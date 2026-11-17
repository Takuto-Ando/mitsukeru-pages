import { test, expect } from "vitest";
import { stabilizePoint } from "../../src/drawing/smooth";

test("生の位置に向かって follow の割合だけ進む", () => {
  expect(stabilizePoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.6)).toEqual({
    x: 6,
    y: 12,
  });
});

test("follow=1 で生の位置そのもの、follow=0 で前の点のまま", () => {
  const previous = { x: 3, y: 4 };
  const raw = { x: 9, y: 12 };
  expect(stabilizePoint(previous, raw, 1)).toEqual(raw);
  expect(stabilizePoint(previous, raw, 0)).toEqual(previous);
});

test("既定の follow は 0.6", () => {
  expect(stabilizePoint({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({
    x: 6,
    y: 0,
  });
});
