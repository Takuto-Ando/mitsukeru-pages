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

test("ライブ検出は位置と大きさが変わっても同じ枠を更新する", async () => {
  const { trackLiveBoxes } = await import("../../src/recognition/liveBoxes");
  const left = {
    label: "キリン",
    score: 0.8,
    left: 0.1,
    top: 0.1,
    right: 0.35,
    bottom: 0.6,
  };
  const right = { ...left, left: 0.6, right: 0.9 };
  let id = 0;
  const before = trackLiveBoxes([], [left, right], () => ++id);
  const after = trackLiveBoxes(
    before,
    [right, { ...left, right: 0.42, bottom: 0.72 }],
    () => ++id,
  );
  expect(after.map((box) => box.id)).toEqual([before[1].id, before[0].id]);
  expect(after[1].bottom).toBe(0.72);
  expect(trackLiveBoxes(after, [], () => ++id)).toEqual([]);
});
