import { test, expect } from "vitest";
import { animalLabels, chooseCandidates } from "../../src/recognition/labels";
import {
  adoptedAnimalById,
  adoptedAnimals,
} from "../../src/content/adoptedAnimals";
import oldBank from "../../src/recognition/bioclip-labels.json";
import promptBank from "../../src/recognition/bioclip-labels-30.json";
import referenceBank from "../../src/recognition/bioclip-photo-references-30.json";
import { groupPhotoReferences } from "../../src/recognition/rosterPhotoReferences";
import {
  classifyRosterBioClip,
  nonAnimalRejections,
} from "../../src/recognition/rosterClassifier";
import { speciesRecognizer } from "../../src/recognition/species";
import { individualRecognizer } from "../../src/recognition/individual";
test("以前からの認識ラベルのうち採用した動物だけを候補へ対応付ける", () => {
  for (const [id, label] of animalLabels.filter(([id]) => id !== "zebra"))
    expect(
      chooseCandidates([
        { label, score: 0.8 },
        { label: "a dog", score: 0.1 },
      ])[0].groupId,
    ).toBe(id);
});
test("BioCLIPは対象外の動物を無視し、非動物の棄却候補を維持する", () => {
  const known = { label: "giraffe", cosine: 0.32 };
  const ignored = { label: "zebra", cosine: 0.4 };
  expect(classifyRosterBioClip([ignored])).toMatchObject({ candidates: [] });
  expect(classifyRosterBioClip([ignored, known])).toEqual(
    classifyRosterBioClip([known]),
  );
  expect(
    classifyRosterBioClip([known, { label: "cage bars", cosine: 0.318 }])
      .candidates,
  ).toEqual([]);
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
test("新旧バンクを維持し、新しいベクトルは30組と非動物ラベルだけを持つ", () => {
  expect(oldBank.labels).toHaveLength(115);
  expect(promptBank.labels).toEqual([
    ...adoptedAnimals.map(({ id }) => id),
    ...nonAnimalRejections,
  ]);
  const vectors = Buffer.from(promptBank.vectors, "base64");
  expect(vectors).toHaveLength(promptBank.labels.length * 512);
  for (const [index, label] of promptBank.labels.entries())
    expect(
      vectors.subarray(index * 512, (index + 1) * 512).some(Boolean),
      label,
    ).toBe(true);
});
test("BioCLIPは図鑑の追加種も明瞭なら確定し、近い種は候補として並べる", () => {
  const redPanda = "kyoto-a-fulgens";
  const blackBear = "bear";
  const fence = "cage bars";
  expect(
    classifyRosterBioClip([
      { label: redPanda, cosine: 0.36 },
      { label: blackBear, cosine: 0.3 },
      { label: fence, cosine: 0.21 },
    ]),
  ).toMatchObject({
    recognition: { speciesId: "kyoto-a-fulgens", status: "identified" },
  });
  const uncertain = classifyRosterBioClip([
    { label: redPanda, cosine: 0.36 },
    { label: blackBear, cosine: 0.34 },
    { label: fence, cosine: 0.21 },
  ]);
  expect(uncertain.recognition.status).toBe("uncertain");
  expect(uncertain.candidates.map(({ speciesId }) => speciesId)).toEqual([
    "kyoto-a-fulgens",
    "bear",
  ]);
  expect(
    classifyRosterBioClip([
      { label: redPanda, cosine: 0.36 },
      { label: fence, cosine: 0.357 },
    ]).candidates,
  ).toEqual([]);
  expect(
    classifyRosterBioClip([
      { label: redPanda, cosine: 0.23 },
      { label: fence, cosine: 0.1 },
    ]).recognition.status,
  ).toBe("unknown");
});
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

test("低い検出スコアの枠は同じ位置が続いたときだけ表示する", async () => {
  const { confirmLiveBoxes, decodeLiveBoxes, trackLiveBoxes } =
    await import("../../src/recognition/liveBoxes");
  const modelOutput = new Float32Array((52 ** 2 + 26 ** 2 + 13 ** 2) * 85);
  modelOutput.set([0.5, 0.5, 2.5, 2.5, 0.5], (20 * 52 + 20) * 85);
  modelOutput[(20 * 52 + 20) * 85 + 5 + 15] = 0.4;
  const [weak] = decodeLiveBoxes(modelOutput, 416, 416);
  expect(weak?.score).toBeCloseTo(0.2);
  const strong = { ...weak, score: 0.8 };
  const next = { ...weak, label: "鳥", left: weak.left + 0.01 };
  const elsewhere = { ...next, left: 0.65, right: 0.95 };
  expect(confirmLiveBoxes([], [weak, strong])).toEqual([strong]);
  expect(confirmLiveBoxes([weak], [elsewhere])).toEqual([]);
  expect(confirmLiveBoxes([weak], [next])).toEqual([next]);
  expect(trackLiveBoxes([{ ...strong, id: 1 }], [next], () => 2)[0].id).toBe(1);
});

test("見本写真で近い候補を並べ替えても非動物判定を維持する", () => {
  const output = [
    { label: "bear", cosine: 0.34 },
    { label: "kyoto-a-fulgens", cosine: 0.331 },
    { label: "cage bars", cosine: 0.23 },
    { label: "goat", cosine: 0.22 },
  ];
  const requests: (readonly string[])[] = [];
  const match = (ids: readonly string[]) => {
    requests.push(ids);
    return new Map([
      ["kyoto-a-fulgens", 0.83],
      ["bear", 0.61],
      ["goat", 0.98],
    ]);
  };
  const corrected = classifyRosterBioClip(output, match);
  expect(corrected.recognition).toMatchObject({
    speciesId: "kyoto-a-fulgens",
    status: "uncertain",
  });
  expect(corrected.candidates[0].score).toBeGreaterThan(0.6);
  expect(requests).toEqual([["bear", "kyoto-a-fulgens"]]);
  expect(
    classifyRosterBioClip(
      [{ label: "cage bars", cosine: 0.39 }, ...output.slice(0, 2)],
      match,
    ).candidates,
  ).toEqual([]);
  expect(requests).toHaveLength(1);
});

test("見本写真データの破損や対象種の欠落時は元の候補を使う", async () => {
  const { createPhotoReferenceMatcher } =
    await import("../../src/recognition/photoReferenceMatcher");
  const { default: bank } =
    await import("../../src/recognition/bioclip-photo-references.json");
  expect(new Set(bank.speciesIds).size).toBe(97);
  expect(bank.speciesIds).toContain("kyoto-a-fulgens");
  expect(Buffer.from(bank.vectors, "base64")).toHaveLength(
    512 * bank.speciesIds.length,
  );
  expect(
    createPhotoReferenceMatcher({ speciesIds: ["goat"], vectors: "!" }),
  ).toBeUndefined();
  const match = createPhotoReferenceMatcher(bank);
  expect(match).toBeDefined();
  const firstTemplate = new Float32Array(
    new Int8Array(Buffer.from(bank.vectors, "base64").subarray(0, 512)),
  );
  expect(
    match?.(firstTemplate, [bank.speciesIds[0]]).get(bank.speciesIds[0]),
  ).toBeCloseTo(1);
  const incomplete = [
    { label: "giraffe", cosine: 0.34 },
    { label: "goat", cosine: 0.33 },
    { label: "a dog", cosine: 0.21 },
  ];
  expect(
    classifyRosterBioClip(incomplete, () => new Map([["goat", 0.99]])),
  ).toEqual(classifyRosterBioClip(incomplete));
});

test("モデルが明確に識別した種は見本写真で変更しない", () => {
  const text = [
    { label: "giraffe", cosine: 0.36 },
    { label: "goat", cosine: 0.31 },
    { label: "cage bars", cosine: 0.21 },
  ];
  const match = () => {
    throw new Error("十分に明確な種では見本を参照しない");
  };
  expect(classifyRosterBioClip(text, match)).toEqual(
    classifyRosterBioClip(text),
  );
});

test("写真参照バンクは採用グループの種に限り、別名の見本を同じグループに照合する", () => {
  expect(new Set(referenceBank.speciesIds)).toEqual(
    new Set(adoptedAnimalById.keys()),
  );
  expect(Buffer.from(referenceBank.vectors, "base64")).toHaveLength(
    referenceBank.speciesIds.length * 512,
  );
  const requested: (readonly string[])[] = [];
  const matched = groupPhotoReferences(
    (_features, speciesIds) => {
      requested.push(speciesIds);
      return new Map([
        ["goat", 0.4],
        ["sheep", 0.8],
        ["kyoto-p-roseus", 0.7],
        ["zebra", 0.95],
      ]);
    },
    new Float32Array(512),
    ["goat", "kyoto-p-chilensis", "zebra"],
  );
  expect(requested).toEqual([
    ["goat", "sheep", "kyoto-p-chilensis", "kyoto-p-ruber", "kyoto-p-roseus"],
  ]);
  expect([...matched]).toEqual([
    ["goat", 0.8],
    ["kyoto-p-chilensis", 0.7],
  ]);
});
