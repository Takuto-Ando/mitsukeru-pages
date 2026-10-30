import { test, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { tasks, tasksForGroup } from "../../src/content/tasks";
import { groups } from "../../src/content/groups";
import { artwork } from "../../src/content/artwork";
import { createResearchRecorder } from "../../src/research/recorder";
test("20グループ34課題、別部位を別IDと固有素材・マスクで管理", () => {
  expect(tasks).toHaveLength(34);
  expect(new Set(tasks.map((t) => t.id)).size).toBe(34);
  expect(new Set(tasks.map((t) => artwork[t.id].incomplete)).size).toBe(34);
  for (const group of groups)
    expect(tasksForGroup(group.id).length).toBeGreaterThan(0);
  for (const t of tasks) {
    expect(t.question.length).toBeGreaterThan(8);
    expect(t.explanation.form.length).toBeGreaterThan(10);
    expect(t.explanation.ecology.length).toBeGreaterThan(10);
    expect(existsSync("public/" + artwork[t.id].incomplete)).toBe(true);
    expect(t.scene.frameHeight).toBe(600);
    const reference = artwork[t.id].reference!;
    expect(reference).toBe(artwork[t.id].explanation);
    const complete = readFileSync("public/" + reference, "utf8");
    expect(complete).toContain('data-illustration="complete"');
    expect(complete).toContain('viewBox="0 0 600 600"');
    expect(complete).toContain('width="600" height="600"');
    expect(complete).not.toBe(
      readFileSync("public/" + artwork[t.id].incomplete, "utf8"),
    );
    expect(t.scene.regions.length).toBeGreaterThan(0);
    for (const r of t.scene.regions)
      expect(
        r.x >= 0 && r.y >= 0 && r.x + r.width <= 1 && r.y + r.height <= 1,
      ).toBe(true);
    expect(t.scene.answerPath || t.id === "goat").toBeTruthy();
    expect(t.hints?.length).toBeGreaterThanOrEqual(2);
  }
  const allHints = tasks.flatMap((t) => t.hints || []);
  expect(new Set(allHints).size).toBe(allHints.length);
  expect(tasks.find((t) => t.id === "goat")?.hints).toEqual([
    "目の真ん中を見てみよう。",
    "縦と横、どちらに長いかな？",
  ]);
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

test("資料の全30カードを重複なく追跡し、追加課題と区別する", async () => {
  const { sourceCards, materialTasks, sharedCardTasks } =
    await import("../../src/content/materialTasks");
  expect(sourceCards).toHaveLength(30);
  expect(new Set(sourceCards.map(([id]) => id)).size).toBe(30);
  expect(groups).toHaveLength(20);
  for (const [id, page] of sourceCards) {
    expect(
      tasks.find((t) => t.id === id),
      `${page}ページ: ${id}`,
    ).toBeTruthy();
    expect(page).toBeGreaterThanOrEqual(11);
    expect(page).toBeLessThanOrEqual(20);
  }
  expect(
    tasks
      .filter(
        (t) =>
          !sourceCards.some(
            ([id]) => id === t.id || sharedCardTasks[id]?.includes(t.id),
          ),
      )
      .map((t) => t.id)
      .sort(),
  ).toEqual(["gibbon", "hippo-body"]);
  for (const m of materialTasks) {
    const t = tasks.find((t) => t.id === m.id)!;
    expect(t.automatic).toBe(false);
    expect(t.method).toBe("selfCheck");
    const complete = readFileSync("public/" + artwork[m.id].reference, "utf8");
    expect(complete).toContain(m.answerPath);
    expect(complete).not.toMatch(/href="https?:/);
  }
});
