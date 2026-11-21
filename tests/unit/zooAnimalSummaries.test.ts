import { expect, test } from "vitest";
import { kyotoCatalog, zooSource } from "../../src/content/kyotoCatalog";
import {
  zooAnimalSummary,
  zooAnimalSummarySource,
} from "../../src/content/zooAnimalSummaries";

test("公式図鑑の各種に短い2行の説明と種別出典がある", () => {
  for (const species of kyotoCatalog) {
    const lines = zooAnimalSummary(species.id)?.split("\n") ?? [];
    expect(lines, species.id).toHaveLength(2);
    expect(lines.every((line) => line.length > 0 && line.length <= 18)).toBe(
      true,
    );
    expect(zooAnimalSummarySource(species.id)).toBe(zooSource(species.slug));
  }
});

test("キリンの舌には園の追加解説を使い、動物未確定時は表示文を返さない", () => {
  expect(zooAnimalSummary("giraffe", "giraffe")).toContain("高い木の葉を舌で");
  expect(zooAnimalSummary("giraffe")).not.toContain("舌");
  expect(zooAnimalSummarySource("giraffe", "giraffe")).toContain(
    "anone758.pdf",
  );
  expect(zooAnimalSummary("goat", "sheep")).toBe(zooAnimalSummary("sheep"));
  expect(zooAnimalSummary("zebra")).toContain("奥歯");
  expect(zooAnimalSummary(undefined)).toBeUndefined();
  expect(zooAnimalSummary("unknown")).toBeUndefined();
});
