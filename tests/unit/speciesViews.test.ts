import { afterEach, expect, test, vi } from "vitest";
import { recognizeSpeciesViews } from "../../src/recognition/speciesViews";
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
  const result = await recognizeSpeciesViews(
    [
      { photo: "masked", source: "focus" },
      { photo: "masked", source: "focus", fit: "contain" },
      { photo: "whole" },
    ],
    () => true,
  );
  expect(result.supported?.speciesId).toBe(redPanda);
  expect(recognize).toHaveBeenCalledTimes(2);
});

test("囲いの全体と枠内で別の動物が出た場合は名前を断定しない", async () => {
  vi.spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(redPanda, 0.63))
    .mockResolvedValueOnce(outcome("kyoto-v-vulpes", 0.9, true));
  const result = await recognizeSpeciesViews(
    [{ photo: "masked", source: "focus" }, { photo: "whole" }],
    () => true,
  );
  expect(result.supported).toBeUndefined();
  expect(result.primary).toBeUndefined();
  expect(result.candidates.map(({ speciesId }) => speciesId)).toContain(
    redPanda,
  );
});

test("枠がないときも信頼性の高い写真全体の判定は使える", async () => {
  vi.spyOn(speciesRecognizer, "recognize").mockResolvedValue(
    outcome(redPanda, 0.88, true),
  );
  const result = await recognizeSpeciesViews([{ photo: "whole" }], () => true);
  expect(result.supported?.speciesId).toBe(redPanda);
});
