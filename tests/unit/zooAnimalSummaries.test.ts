import { expect, test } from "vitest";
import { kyotoCatalog, zooSource } from "../../src/content/kyotoCatalog";
import {
  adoptedAnimalById,
  adoptedAnimals,
} from "../../src/content/adoptedAnimals";
import { uncoveredWords } from "../../src/furigana/coverage";
import {
  zooAnimalSummary,
  zooAnimalSummarySource,
} from "../../src/content/zooAnimalSummaries";

test("公式図鑑の各種に2文の説明と種別参照先がある", () => {
  for (const species of kyotoCatalog) {
    const lines = zooAnimalSummary(species.id)?.split("\n") ?? [];
    expect(lines, species.id).toHaveLength(2);
    expect(lines.every((line) => line.length > 0)).toBe(true);
    expect(zooAnimalSummarySource(species.id)).toBe(zooSource(species.slug));
  }
});

test("採用した動物とその別種IDに、指定の説明を改行も含めて使う", () => {
  for (const [id, animal] of adoptedAnimalById)
    expect(zooAnimalSummary(id)).toBe(animal.description);
  expect(
    adoptedAnimals.map(({ description }) => description.split("\n").length),
  ).toEqual(Array(30).fill(2));
  expect(
    uncoveredWords(adoptedAnimals.map(({ description }) => description)),
  ).toEqual([]);
});

test("キリンの舌には園の追加解説を使い、動物未確定時は表示文を返さない", () => {
  expect(zooAnimalSummary("giraffe", "giraffe")).toBe(
    "長い舌は枝から葉だけを食べるのに役立ちます。\n紫色は日差しから舌を守るための色です。",
  );
  expect(zooAnimalSummary("giraffe")).not.toContain("舌");
  expect(zooAnimalSummarySource("giraffe", "giraffe")).toContain(
    "anone758.pdf",
  );
  expect(zooAnimalSummary("goat", "sheep")).toBe(zooAnimalSummary("sheep"));
  expect(zooAnimalSummary("zebra")).toContain("奥歯");
  expect(zooAnimalSummary(undefined)).toBeUndefined();
  expect(zooAnimalSummary("unknown")).toBeUndefined();
});
