import { test, expect } from "vitest";
import { drawingHistory, emptyDrawing } from "../../src/drawing/history";
const one = [
  [
    { x: 200, y: 200 },
    { x: 240, y: 220 },
  ],
];
test("描画、消去、Undoで元の線を取り戻し、全消去もUndoできる", () => {
  const drawn = drawingHistory(emptyDrawing(), {
    type: "commit",
    strokes: one,
  });
  const erased = drawingHistory(drawn, { type: "commit", strokes: [] });
  expect(drawingHistory(erased, { type: "undo" }).present).toBe(one);
  expect(drawingHistory(drawn, { type: "undo" }).present).toEqual([]);
  expect(drawingHistory(drawn, { type: "reset" })).toEqual(emptyDrawing());
});
