import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  kyotoCatalog,
  kyotoDrafts,
  zooSource,
} from "../../src/content/kyotoCatalog";
import { challengeProvider } from "../../src/domain";
import { artwork } from "../../src/content/artwork";
import { tasks } from "../../src/content/tasks";
import {
  chooseCandidates,
  recognitionFromOutput,
  speciesPrompts,
} from "../../src/recognition/labels";

test("公式図鑑98種すべてを種ID・観察課題・認識候補へ対応付ける", () => {
  expect(kyotoCatalog).toHaveLength(98);
  expect(new Set(kyotoCatalog.map((species) => species.slug)).size).toBe(98);
  expect(new Set(kyotoCatalog.map((species) => species.id)).size).toBe(98);
  const candidates = speciesPrompts.flatMap((label) =>
    chooseCandidates([{ label, score: 0.75 }]),
  );
  for (const species of kyotoCatalog) {
    expect(
      challengeProvider.forSpecies(species.id).length,
      species.name,
    ).toBeGreaterThan(0);
    expect(candidates).toContainEqual({
      speciesId: species.id,
      groupId: species.groupId,
      score: 0.75,
    });
  }
  expect(
    recognitionFromOutput([{ label: "a giraffe", score: 0.75 }]),
  ).toMatchObject({
    status: "identified",
    speciesId: "giraffe",
  });
});

test("仮課題78件は固有のSVGと正規化された描画位置を持ち、比較で自己確認する", () => {
  expect(kyotoDrafts).toHaveLength(78);
  const added = tasks.filter((task) => task.provisional);
  expect(added).toHaveLength(78);
  expect(new Set(added.map((task) => artwork[task.id].reference)).size).toBe(
    78,
  );
  for (const species of kyotoDrafts) {
    const [task] = challengeProvider.forSpecies(species.id);
    expect(task).toMatchObject({
      source: zooSource(species.slug),
      method: "selfCheck",
      automatic: false,
      provisional: true,
    });
    const art = artwork[task.id];
    const incomplete = readFileSync("public/" + art.incomplete, "utf8");
    const complete = readFileSync("public/" + art.reference, "utf8");
    expect(incomplete).not.toContain(task.scene.answerPath);
    expect(complete).toContain(task.scene.answerPath);
    expect(complete).toContain('viewBox="0 0 600 600"');
    for (const { x, y, width, height } of task.scene.regions) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(x + width).toBeLessThanOrEqual(1);
      expect(y + height).toBeLessThanOrEqual(1);
    }
    expect(
      recognitionFromOutput([{ label: species.prompt!, score: 0.95 }]),
    ).toMatchObject({
      status: "uncertain",
      speciesId: species.id,
    });
  }
});
