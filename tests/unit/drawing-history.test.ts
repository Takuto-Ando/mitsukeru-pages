import { test, expect } from "vitest";
import { drawingHistory, emptyDrawing } from "../../src/drawing/history";
import { drawingFocus } from "../../src/drawing/focus";
import { tasks } from "../../src/content/tasks";
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
test("全20課題でフォーカス後も空欄全体に余白があり、最大3.2倍", () => {
  for (const task of tasks) {
    const focus = drawingFocus(task.scene),
      height = task.scene.frameHeight || 400;
    expect(focus.scale >= 1 && focus.scale <= 3.2).toBe(true);
    for (const r of task.scene.regions) {
      const x = r.x * 600 * focus.scale + focus.x * 6;
      const y = r.y * height * focus.scale + (focus.y * height) / 100;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + r.width * 600 * focus.scale).toBeLessThanOrEqual(600);
      expect(y + r.height * height * focus.scale).toBeLessThanOrEqual(height);
    }
  }
});
