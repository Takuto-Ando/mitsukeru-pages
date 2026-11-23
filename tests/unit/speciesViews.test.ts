import { afterEach, expect, test, vi } from "vitest";
import { recognizePhotoSpecies } from "../../src/recognition/speciesViews";
import {
  speciesRecognizer,
  type SpeciesResult,
} from "../../src/recognition/species";

const redPanda = "kyoto-a-fulgens";
const outcome = (
  id: string,
  score: number,
  identified = false,
): SpeciesResult => ({
  status: "candidates",
  candidates: [{ speciesId: id, groupId: id, score }],
  recognition: {
    speciesId: id,
    confidence: score,
    modelVersion: "test",
    status: identified ? "identified" : "uncertain",
  },
});

afterEach(() => vi.restoreAllMocks());

test("枠の2つの見え方が一致したら全体の推論を追加せず名前を使う", async () => {
  const recognize = vi
    .spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(redPanda, 0.49))
    .mockResolvedValueOnce(outcome(redPanda, 0.61));
  const result = await recognizePhotoSpecies(
    { full: "whole", crop: "masked" },
    () => true,
  );
  expect(result.supported?.speciesId).toBe(redPanda);
  expect(recognize).toHaveBeenCalledTimes(2);
});

test("写真全体と枠内で別の動物が出た場合は名前を断定しない", async () => {
  vi.spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(redPanda, 0.63))
    .mockResolvedValueOnce({ status: "unknown", reason: "ambiguous" })
    .mockResolvedValueOnce(outcome("kyoto-v-vulpes", 0.9, true))
    .mockResolvedValueOnce({ status: "unknown", reason: "ambiguous" });
  const result = await recognizePhotoSpecies(
    { full: "whole", crop: "masked" },
    () => true,
  );
  expect(result.supported).toBeUndefined();
  expect(result.primary).toBeUndefined();
  expect(result.suggestion).toBeUndefined();
  expect(result.candidates.map(({ speciesId }) => speciesId)).toEqual([
    redPanda,
    "kyoto-v-vulpes",
  ]);
});

test("枠がないときも信頼性の高い写真全体の判定は使える", async () => {
  vi.spyOn(speciesRecognizer, "recognize").mockResolvedValue(
    outcome(redPanda, 0.88, true),
  );
  const result = await recognizePhotoSpecies({ full: "whole" }, () => true);
  expect(result.supported?.speciesId).toBe(redPanda);
});

test("写真の候補が1つでも確認できないときは確定と区別する", async () => {
  vi.spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(redPanda, 0.64))
    .mockResolvedValueOnce({ status: "unknown", reason: "ambiguous" });
  const result = await recognizePhotoSpecies({ full: "whole" }, () => true);
  expect(result.suggestion?.speciesId).toBe(redPanda);
  expect(result.supported).toBeUndefined();
});

test("必要な映像だけを画像化し、使わなかった全体画像は作らない", async () => {
  const blob = new Blob(["frame"], { type: "image/jpeg" });
  const crop = vi.fn().mockResolvedValue(blob);
  const full = vi.fn().mockResolvedValue(blob);
  const recognize = vi
    .spyOn(speciesRecognizer, "recognize")
    .mockResolvedValue(outcome(redPanda, 0.9, true));
  const result = await recognizePhotoSpecies({ full, crop }, () => true);
  expect(result.supported?.speciesId).toBe(redPanda);
  expect(crop).toHaveBeenCalledTimes(2);
  expect(recognize).toHaveBeenNthCalledWith(1, blob, undefined, undefined);
  expect(recognize).toHaveBeenNthCalledWith(2, blob, undefined, "contain");
  expect(full).not.toHaveBeenCalled();
});

test("枠だけの最初の読み違いは、枠と写真全体が一致した候補を優先する", async () => {
  const fox = "kyoto-v-vulpes";
  const recognize = vi
    .spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(fox, 0.92, true))
    .mockResolvedValueOnce(outcome(redPanda, 0.71))
    .mockResolvedValueOnce(outcome(redPanda, 0.83, true))
    .mockResolvedValueOnce(outcome(redPanda, 0.79, true));

  const result = await recognizePhotoSpecies(
    { full: "whole", crop: "focused" },
    () => true,
  );
  expect(result.supported?.speciesId).toBe(redPanda);
  expect(result.candidates.map(({ speciesId }) => speciesId)).toEqual([
    redPanda,
    fox,
  ]);
  expect(recognize.mock.calls.map(([photo, , fit]) => [photo, fit])).toEqual([
    ["focused", undefined],
    ["focused", "contain"],
    ["whole", undefined],
    ["whole", "contain"],
  ]);
});
