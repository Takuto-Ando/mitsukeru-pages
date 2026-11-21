import { test, expect } from "vitest";
import { chooseCandidates, animalLabels } from "../../src/recognition/labels";
import { speciesRecognizer } from "../../src/recognition/species";
import { individualRecognizer } from "../../src/recognition/individual";
test("17グループとヒツジ別名を候補へ対応付ける", () => {
  expect(new Set(animalLabels.map(([id]) => id)).size).toBe(17);
  for (const [id, label] of animalLabels)
    expect(
      chooseCandidates([
        { label, score: 0.8 },
        { label: "a dog", score: 0.1 },
      ])[0].groupId,
    ).toBe(id);
});
test("対象外と曖昧な写真を断定しない", () => {
  expect(
    chooseCandidates([
      { label: "a dog", score: 0.8 },
      { label: "a goat", score: 0.1 },
    ]),
  ).toEqual([]);
  expect(
    chooseCandidates([
      { label: "a goat", score: 0.35 },
      { label: "a donkey", score: 0.34 },
    ]),
  ).toEqual([]);
  expect(chooseCandidates([{ label: "a goat", score: NaN }])).toEqual([]);
  expect(chooseCandidates([])).toEqual([]);
});
test("ヤギとヒツジは候補を区別して同じ保存グループを使う", () =>
  expect(
    chooseCandidates([
      { label: "a goat", score: 0.6 },
      { label: "a sheep", score: 0.3 },
      { label: "a dog", score: 0.01 },
    ]),
  ).toMatchObject([
    { groupId: "goat", speciesId: "goat" },
    { groupId: "goat", speciesId: "sheep" },
  ]));
test("写真なしでは推測せず個体識別も行わない", async () => {
  expect((await speciesRecognizer.recognize("test-photo")).status).toBe(
    "unavailable",
  );
  expect(
    (await individualRecognizer.identify("test-photo", "goat")).status,
  ).toBe("unknown");
});
