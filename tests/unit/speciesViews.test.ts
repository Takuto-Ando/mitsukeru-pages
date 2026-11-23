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

test("全体に有力な候補が出た時点で知らせ、確定とは区別する", async () => {
  let resolveLast!: (result: SpeciesResult) => void;
  vi.spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(redPanda, 0.64))
    .mockImplementationOnce(
      () => new Promise((resolve) => (resolveLast = resolve)),
    );
  const onSuggestion = vi.fn();
  const pending = recognizeSpeciesViews(
    [{ photo: "whole" }, { photo: "whole", fit: "contain" }],
    () => true,
    undefined,
    onSuggestion,
  );
  await vi.waitFor(() =>
    expect(onSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ speciesId: redPanda }),
    ),
  );
  resolveLast({ status: "unknown", reason: "ambiguous" });
  const result = await pending;
  expect(result.suggestion?.speciesId).toBe(redPanda);
  expect(result.supported).toBeUndefined();
});

test("全体や枠に証拠がない場合は部分拡大だけを初期候補に使わない", async () => {
  vi.spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce({ status: "unknown", reason: "empty" })
    .mockResolvedValueOnce(outcome(redPanda, 0.92, true));
  const onSuggestion = vi.fn();
  const result = await recognizeSpeciesViews(
    [{ photo: "whole" }, { photo: "corner", source: "tile" }],
    () => true,
    undefined,
    onSuggestion,
  );
  expect(onSuggestion).not.toHaveBeenCalled();
  expect(result.suggestion).toBeUndefined();
});

test("枠付きの別々の拡大で一致した候補を、確認を待たずに知らせる", async () => {
  let finish!: (result: SpeciesResult) => void;
  const fox = "kyoto-v-vulpes";
  vi.spyOn(speciesRecognizer, "recognize")
    .mockResolvedValueOnce(outcome(fox, 0.7))
    .mockResolvedValueOnce(outcome(redPanda, 0.7))
    .mockResolvedValueOnce(outcome(redPanda, 0.8))
    .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  const suggest = vi.fn();
  const result = recognizeSpeciesViews(
    [
      { photo: "focus", source: "focus" },
      { photo: "middle", source: "tile" },
      { photo: "left", source: "tile" },
      { photo: "whole", fit: "contain" },
    ],
    () => true,
    undefined,
    suggest,
  );

  await vi.waitFor(() =>
    expect(suggest.mock.calls).toEqual([
      [expect.objectContaining({ speciesId: fox })],
      [expect.objectContaining({ speciesId: redPanda }), "agreement"],
    ]),
  );
  finish(outcome(fox, 0.75));
  expect(await result).toMatchObject({
    supported: undefined,
    suggestion: { speciesId: redPanda },
  });
});

test("必要な映像だけを画像化し、使わなかった切り出しは作らない", async () => {
  const blob = new Blob(["frame"], { type: "image/jpeg" });
  const first = vi.fn().mockResolvedValue(blob);
  const fallback = vi.fn().mockResolvedValue(blob);
  const recognize = vi
    .spyOn(speciesRecognizer, "recognize")
    .mockResolvedValue(outcome(redPanda, 0.9, true));
  const result = await recognizeSpeciesViews(
    [{ photo: first }, { photo: fallback, fit: "contain" }],
    () => true,
  );
  expect(result.supported?.speciesId).toBe(redPanda);
  expect(first).toHaveBeenCalledOnce();
  expect(recognize).toHaveBeenCalledExactlyOnceWith(blob, undefined, undefined);
  expect(fallback).not.toHaveBeenCalled();
});
