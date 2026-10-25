import { test, expect } from "vitest";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  registry,
  validateManifest,
  coverage,
  evaluate,
  loadDataset,
} from "../../tools/recognition/evaluation.mjs";
import { animalLabels } from "../../src/recognition/labels";
const sample = (
  id: string,
  speciesId = "goat",
  split = "test",
  captureGroup = id,
) => ({
  id,
  speciesId,
  split,
  captureGroup,
  file: `${id}.png`,
  usagePermission: "Owned test fixture",
});
const manifest = (samples: ReturnType<typeof sample>[]) => ({
  version: 1,
  samples,
});

test("18種と現在の種ラベルが一致し、ヒツジとヤギを分離する", () => {
  expect(registry.species).toHaveLength(18);
  expect(new Set(registry.species.map((s: { id: string }) => s.id)).size).toBe(
    18,
  );
  expect(
    registry.species.map((s: { groupId: string }) => s.groupId).sort(),
  ).toEqual(animalLabels.map(([id]) => id).sort());
  expect(
    registry.species.find((s: { id: string }) => s.id === "sheep").groupId,
  ).toBe("goat");
  expect(
    registry.species.find((s: { id: string }) => s.id === "bush-dog")
      .drawingAvailable,
  ).toBe(false);
});
test("撮影グループ混入、重複ID、無効ラベル、外部写真、利用条件欠落を拒否する", () => {
  expect(() =>
    validateManifest(
      manifest([
        sample("a", "goat", "train", "same"),
        sample("b", "goat", "test", "same"),
      ]),
    ),
  ).toThrow(/複数split/);
  expect(() => validateManifest(manifest([sample("a"), sample("a")]))).toThrow(
    /重複/,
  );
  expect(() => validateManifest(manifest([sample("a", "lion")]))).toThrow(
    /未登録/,
  );
  for (const file of [
    "../photo.png",
    "https://example.com/photo.png",
    "/tmp/photo.png",
    "a\\photo.png",
  ]) {
    expect(() =>
      validateManifest(manifest([{ ...sample("a"), file }])),
    ).toThrow(/パス/);
  }
  expect(() =>
    validateManifest(manifest([{ ...sample("a"), usagePermission: "" }])),
  ).toThrow(/利用条件/);
});
test("未評価の種や対象外が欠ける場合はゼロ枚で明示する", () => {
  const result = coverage([sample("a")]);
  expect(result.test.goat).toBe(1);
  expect(result.test.sheep).toBe(0);
  expect(result.test.unknown).toBe(0);
});
test("自己保留と実行失敗を正解扱いせず、種別成績と対象外の誤受理を計算する", () => {
  const data = manifest([
    sample("goat"),
    sample("sheep", "sheep"),
    sample("bad", "unknown"),
    sample("reject", "unknown"),
    sample("failure", "fennec"),
  ]);
  const predictions = {
    version: 1,
    model: "fixture-only",
    results: [
      { id: "goat", status: "identified", speciesId: "goat", elapsedMs: 10 },
      { id: "sheep", status: "uncertain", speciesId: "sheep", elapsedMs: 20 },
      { id: "bad", status: "identified", speciesId: "goat", elapsedMs: 30 },
      { id: "reject", status: "unknown", speciesId: null, elapsedMs: 40 },
      { id: "failure", status: "unavailable", speciesId: null, elapsedMs: 50 },
    ],
  };
  const result = evaluate(data, predictions);
  expect(result.autoConfirmPrecision).toBe(0.5);
  expect(result.knownAutoConfirmRecall).toBe(1 / 3);
  expect(result.unknownFalseAcceptRate).toBe(0.5);
  expect(result.unknownRejectRate).toBe(0.5);
  expect(result.manualFallbackRate).toBe(0.6);
  expect(result.unavailable).toBe(1);
  expect(result.elapsedMs).toEqual({ median: 30, p95: 50 });
  expect(
    result.perSpecies.find(
      (s: { speciesId: string }) => s.speciesId === "sheep",
    ),
  ).toMatchObject({ support: 1, precision: null, recall: 0 });
  expect(result.missingSpecies).toContain("mandrill");
  expect(result.confusion.unknown.goat).toBe(1);
});
test("結果の欠落・余分・重複・不正値を拒否する", () => {
  const data = manifest([sample("a")]);
  const row = {
    id: "a",
    speciesId: "goat",
    status: "identified",
    elapsedMs: 10,
  };
  for (const results of [
    [],
    [row, row],
    [{ ...row, id: "absent" }],
    [{ ...row, speciesId: null }],
    [{ ...row, elapsedMs: NaN }],
    [{ ...row, status: "correct" }],
  ])
    expect(() =>
      evaluate(data, { version: 1, model: "test", results }),
    ).toThrow();
  expect(
    evaluate(data, { version: 1, model: "test", results: [row] })
      .unknownFalseAcceptRate,
  ).toBeNull();
});
test("同一画像の重複・フォルダ外リンク・不正画像を検出する", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zooketch-model-lab-"));
  const external = await mkdtemp(join(tmpdir(), "zooketch-model-external-"));
  try {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
      "base64",
    );
    await writeFile(join(dir, "a.png"), png);
    await writeFile(join(dir, "b.png"), png);
    const file = join(dir, "dataset.json");
    await writeFile(
      file,
      JSON.stringify(manifest([sample("a"), sample("b", "sheep")])),
    );
    await expect(loadDataset(file)).rejects.toThrow(/同一画像/);
    await writeFile(join(external, "outside.png"), png);
    await symlink(join(external, "outside.png"), join(dir, "outside.png"));
    await writeFile(file, JSON.stringify(manifest([sample("outside")])));
    await expect(loadDataset(file)).rejects.toThrow(/外を指して/);
    await writeFile(join(dir, "bad.png"), "not an image");
    await writeFile(file, JSON.stringify(manifest([sample("bad")])));
    await expect(loadDataset(file)).rejects.toThrow(/画像ではありません/);
    await writeFile(file, JSON.stringify(manifest([sample("a")])));
    const valid = await loadDataset(file);
    expect(valid.counts.test.goat).toBe(1);
    expect(valid.missing).toContain("test:sheep");
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});
