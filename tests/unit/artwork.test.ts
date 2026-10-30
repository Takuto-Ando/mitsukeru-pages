import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { artwork } from "../../src/content/artwork";
import { scenes } from "../../src/content/scenes";
test("34個の専用素材スロットがあり、未提供を完成扱いしない", () => {
  expect(Object.keys(artwork)).toHaveLength(34);
  expect(Object.keys(scenes).every((id) => artwork[id])).toBe(true);
  for (const a of Object.values(artwork)) {
    expect(a.alt.length).toBeGreaterThan(0);
    if (a.status === "reviewed") {
      expect(
        a.incomplete && a.completedBase && a.answer && a.reviewedBy,
      ).toBeTruthy();
    }
    for (const path of [
      a.incomplete,
      a.completedBase,
      a.answer,
      a.explanation,
    ].filter(Boolean))
      expect(existsSync("public/" + path)).toBe(true);
  }
});
test("全動物の配置テンプレートが個別に存在する", () => {
  for (const id of Object.keys(scenes))
    expect(existsSync(`docs/asset-templates/${id}.svg`)).toBe(true);
});
