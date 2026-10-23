import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { tasks, tasksForGroup } from "../../src/content/tasks";
import { groups } from "../../src/content/groups";
import { artwork } from "../../src/content/artwork";
import { createResearchRecorder } from "../../src/research/recorder";
test("16グループ20課題、別部位を別IDと固有素材・マスクで管理", () => {
  expect(tasks).toHaveLength(20);
  expect(new Set(tasks.map((t) => t.id)).size).toBe(20);
  expect(new Set(tasks.map((t) => artwork[t.id].incomplete)).size).toBe(20);
  for (const group of groups)
    expect(tasksForGroup(group.id).length).toBeGreaterThan(0);
  for (const t of tasks) {
    expect(t.question.length).toBeGreaterThan(8);
    expect(t.explanation.form.length).toBeGreaterThan(10);
    expect(t.explanation.ecology.length).toBeGreaterThan(10);
    expect(existsSync("public/" + artwork[t.id].incomplete)).toBe(true);
    expect(t.scene.regions.length).toBeGreaterThan(0);
    for (const r of t.scene.regions)
      expect(
        r.x >= 0 && r.y >= 0 && r.x + r.width <= 1 && r.y + r.height <= 1,
      ).toBe(true);
    expect(t.scene.answerPath || t.id === "goat").toBeTruthy();
  }
});
test("模様は比較確認を標準とし、全課題に判定方法がある", () => {
  for (const t of tasks) {
    expect([
      "orientation",
      "curvature",
      "proportion",
      "placement",
      "pattern",
      "selfCheck",
    ]).toContain(t.method);
    if (t.method === "pattern") expect(t.automatic).toBe(false);
  }
});
test("研究記録はデフォルト無効で同意前後を混在させない", () => {
  let now = 1000;
  const r = createResearchRecorder(() => now);
  r.record("goat", "start");
  expect(r.export()).toEqual([]);
  expect(() => r.enable({ obtained: false })).toThrow();
  r.enable({ obtained: true });
  r.record("goat", "start");
  now = 1500;
  r.record("goat", "drawing-start");
  now = 2000;
  r.record("goat", "drawing-end");
  r.record("goat", "self-confirmation");
  expect(r.export()).toHaveLength(4);
  expect(r.export()[2].elapsedMs).toBe(1000);
  const copy = r.export();
  copy.length = 0;
  expect(r.export()).toHaveLength(4);
  r.disable();
  expect(r.export()).toEqual([]);
});
