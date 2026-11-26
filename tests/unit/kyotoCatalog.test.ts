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
import { adoptedGroups } from "../../src/content/groups";
import {
  adoptedAnimals,
  adoptedAnimalById,
} from "../../src/content/adoptedAnimals";
import {
  chooseCandidates,
  recognitionFromOutput,
  speciesPrompts,
} from "../../src/recognition/labels";
import { classifyRosterBioClip } from "../../src/recognition/rosterClassifier";

test("過去の保存記録は引き続き公式図鑑98種の観察課題を参照できる", () => {
  expect(kyotoCatalog).toHaveLength(98);
  expect(new Set(kyotoCatalog.map((species) => species.slug)).size).toBe(98);
  expect(new Set(kyotoCatalog.map((species) => species.id)).size).toBe(98);
  for (const species of kyotoCatalog) {
    expect(
      challengeProvider.forSpecies(species.id).length,
      species.name,
    ).toBeGreaterThan(0);
  }
});

test("新規観察は指定の30組のみ選択でき、全組の課題と識別候補がある", () => {
  expect(adoptedAnimals).toHaveLength(30);
  expect(new Set(adoptedAnimals.map(({ name }) => name)).size).toBe(30);
  expect(adoptedGroups.map(({ id, name }) => ({ id, name }))).toEqual(
    adoptedAnimals.map(({ id, name }) => ({ id, name })),
  );
  const legacyCandidates = speciesPrompts.flatMap((label) =>
    chooseCandidates([{ label, score: 0.75 }]),
  );
  expect(legacyCandidates.map(({ speciesId }) => speciesId).sort()).toEqual(
    [...adoptedAnimalById.keys()].sort(),
  );
  for (const { id } of adoptedAnimals) {
    expect(
      classifyRosterBioClip([{ label: id, cosine: 0.36 }]).candidates,
    ).toMatchObject([{ groupId: id, speciesId: id }]);
    expect(challengeProvider.forSpecies(id).length).toBeGreaterThan(0);
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
  }
});
