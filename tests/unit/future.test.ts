import { expect, test } from "vitest";
import {
  observationMoment,
  compareObservations,
} from "../../src/future/observationComparison";
import { validatePhotoCard } from "../../src/future/photoCard";
const first = () =>
  observationMoment("goat", " 横に長い ", new Date("2026-10-30T00:00:00Z"));
test("気づき比較はコピーを返し、未記入を許容し、スコアを作らない", () => {
  const before = first();
  const after = observationMoment("goat", "", new Date("2026-10-30T00:02:00Z"));
  const pair = compareObservations(before, after, true);
  before.noticing = "変更";
  expect(pair.before.noticing).toBe("横に長い");
  expect(pair.after.noticing).toBe("");
  expect(Object.keys(pair)).toEqual(["before", "after", "revisitedSelfReport"]);
});
test("異なる課題や逆順の日時を比較しない", () => {
  expect(() =>
    compareObservations(first(), { ...first(), taskId: "bear" }),
  ).toThrow();
  expect(() =>
    compareObservations(first(), {
      ...first(),
      recordedAt: "2026-10-29T00:00:00Z",
    }),
  ).toThrow();
  expect(() =>
    compareObservations(first(), { ...first(), recordedAt: "invalid" }),
  ).toThrow();
});
test("記録の不正日時・空課題・長すぎるメモを拒否", () => {
  expect(() => observationMoment("", "")).toThrow();
  expect(() => observationMoment("goat", "あ".repeat(201))).toThrow();
  expect(() => observationMoment("goat", "", new Date(NaN))).toThrow();
});
test("画像カードの形式・容量・ラベルを呼出時に検証", () => {
  const blob = new Blob(["example"], { type: "image/png" });
  const input = {
    photo: blob,
    sketch: blob,
    animalName: "ヤギ",
    featureName: "瞳孔",
  };
  expect(() => validatePhotoCard(input)).not.toThrow();
  expect(() =>
    validatePhotoCard({ ...input, photo: new Blob([], { type: "image/png" }) }),
  ).toThrow();
  expect(() =>
    validatePhotoCard({
      ...input,
      photo: new Blob(["svg"], { type: "image/svg+xml" }),
    }),
  ).toThrow();
  expect(() =>
    validatePhotoCard({
      ...input,
      photo: new Blob([new Uint8Array(12 * 1024 * 1024 + 1)], {
        type: "image/png",
      }),
    }),
  ).toThrow();
  expect(() => validatePhotoCard({ ...input, animalName: " " })).toThrow();
  expect(() =>
    validatePhotoCard({ ...input, discovery: "あ".repeat(201) }),
  ).toThrow();
});
