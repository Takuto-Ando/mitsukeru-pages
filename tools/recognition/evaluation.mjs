import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
export const registry = JSON.parse(
  await readFile(new URL("./species.json", import.meta.url), "utf8"),
);
const ids = registry.species.map((s) => s.id);
const labels = new Set([...ids, "unknown"]);
const splits = new Set(["train", "validation", "test"]);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
export function validateManifest(data) {
  assert(
    data?.version === 1 && Array.isArray(data.samples),
    "version:1 と samples 配列が必要です",
  );
  const seen = new Set(),
    sessions = new Map();
  for (const s of data.samples) {
    assert(
      s &&
        typeof s.id === "string" &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(s.id) &&
        !seen.has(s.id),
      "画像IDが不正または重複しています",
    );
    seen.add(s.id);
    assert(labels.has(s.speciesId), `${s.id}: 未登録の種IDです`);
    assert(splits.has(s.split), `${s.id}: split は train/validation/test です`);
    assert(
      typeof s.captureGroup === "string" && s.captureGroup.trim().length > 0,
      `${s.id}: 個体・撮影セッションを表す captureGroup が必要です`,
    );
    assert(
      !sessions.has(s.captureGroup) || sessions.get(s.captureGroup) === s.split,
      `${s.id}: 同じ撮影グループが複数splitへ混入しています`,
    );
    sessions.set(s.captureGroup, s.split);
    assert(
      typeof s.file === "string" &&
        !isAbsolute(s.file) &&
        !/[\x00:]/.test(s.file) &&
        !s.file.includes("\\") &&
        !s.file.split("/").includes("..") &&
        /\.(png|jpe?g|webp)$/i.test(s.file),
      `${s.id}: ローカルの相対画像パスを指定してください`,
    );
    assert(
      typeof s.usagePermission === "string" &&
        s.usagePermission.trim().length > 0,
      `${s.id}: 写真の利用条件 usagePermission が必要です`,
    );
  }
  return data;
}
export function coverage(samples) {
  return Object.fromEntries(
    [...splits].map((split) => [
      split,
      Object.fromEntries(
        [...labels].map((id) => [
          id,
          samples.filter((s) => s.split === split && s.speciesId === id).length,
        ]),
      ),
    ]),
  );
}
export async function loadDataset(path) {
  const manifest = validateManifest(JSON.parse(await readFile(path, "utf8")));
  const root = await realpath(dirname(resolve(path))),
    hashes = new Map(),
    files = new Map();
  for (const s of manifest.samples) {
    const file = await realpath(resolve(root, s.file));
    const rel = relative(root, file);
    assert(
      rel && !rel.startsWith("..") && !isAbsolute(rel),
      `${s.id}: 画像がデータセットの外を指しています`,
    );
    const data = await readFile(file);
    const png = data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    const webp =
      data.subarray(0, 4).toString() === "RIFF" &&
      data.subarray(8, 12).toString() === "WEBP";
    assert(png || jpg || webp, `${s.id}: PNG/JPEG/WebP画像ではありません`);
    const hash = createHash("sha256").update(data).digest("hex");
    assert(
      !hashes.has(hash),
      `${s.id}: 同一画像が重複しています（${hashes.get(hash)}）`,
    );
    hashes.set(hash, s.id);
    files.set(s.id, {
      file,
      mime: png ? "image/png" : jpg ? "image/jpeg" : "image/webp",
    });
  }
  const counts = coverage(manifest.samples);
  const missing = [...splits].flatMap((split) =>
    [...labels]
      .filter((id) => !counts[split][id])
      .map((id) => `${split}:${id}`),
  );
  return { manifest, files, counts, missing };
}
const fraction = (n, d) => (d ? n / d : null);
const percentile = (values, p) =>
  values.length
    ? [...values].sort((a, b) => a - b)[
        Math.max(0, Math.ceil(values.length * p) - 1)
      ]
    : null;
export function evaluate(manifest, predictions) {
  validateManifest(manifest);
  assert(
    predictions?.version === 1 &&
      typeof predictions.model === "string" &&
      predictions.model.trim() &&
      Array.isArray(predictions.results),
    "モデル名と results 配列が必要です",
  );
  const samples = manifest.samples.filter((s) => s.split === "test");
  assert(samples.length > 0, "test画像がありません");
  const expected = new Map(samples.map((s) => [s.id, s])),
    rows = new Map();
  for (const r of predictions.results) {
    assert(
      expected.has(r.id) && !rows.has(r.id),
      "結果IDが重複、またはtest画像と一致しません",
    );
    assert(
      ["identified", "uncertain", "unknown", "unavailable"].includes(r.status),
      `${r.id}: 判定状態が不正です`,
    );
    assert(
      r.speciesId === null || ids.includes(r.speciesId),
      `${r.id}: 推論種IDが不正です`,
    );
    assert(
      r.status !== "identified" || r.speciesId !== null,
      `${r.id}: 自動確定に種IDがありません`,
    );
    assert(
      !["unknown", "unavailable"].includes(r.status) || r.speciesId === null,
      `${r.id}: 対象外・実行失敗を種の確定結果として記録できません`,
    );
    assert(
      Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0,
      `${r.id}: 経過時間が不正です`,
    );
    rows.set(r.id, r);
  }
  assert(
    rows.size === samples.length,
    "未評価のtest画像があります。失敗時もunavailableとして記録してください",
  );
  const confusion = {},
    perSpecies = [];
  let accepted = 0,
    correct = 0,
    known = 0,
    unknown = 0,
    falseAccept = 0,
    unknownRejected = 0,
    unavailable = 0;
  for (const s of samples) {
    const r = rows.get(s.id),
      predicted = r.status === "identified" ? r.speciesId : `(${r.status})`;
    confusion[s.speciesId] ??= {};
    confusion[s.speciesId][predicted] =
      (confusion[s.speciesId][predicted] || 0) + 1;
    if (r.status === "unavailable") unavailable++;
    if (s.speciesId !== "unknown") known++;
    else unknown++;
    if (r.status === "identified") {
      accepted++;
      if (r.speciesId === s.speciesId) correct++;
      if (s.speciesId === "unknown") falseAccept++;
    }
    if (s.speciesId === "unknown" && r.status === "unknown") unknownRejected++;
  }
  for (const id of ids) {
    const support = samples.filter((s) => s.speciesId === id).length;
    const predicted = samples.filter(
      (s) =>
        rows.get(s.id).status === "identified" &&
        rows.get(s.id).speciesId === id,
    ).length;
    const tp = samples.filter(
      (s) =>
        s.speciesId === id &&
        rows.get(s.id).status === "identified" &&
        rows.get(s.id).speciesId === id,
    ).length;
    perSpecies.push({
      speciesId: id,
      support,
      autoConfirmed: predicted,
      precision: fraction(tp, predicted),
      recall: fraction(tp, support),
    });
  }
  return {
    version: 1,
    model: predictions.model,
    testImages: samples.length,
    knownImages: known,
    unknownImages: unknown,
    autoConfirmRate: fraction(accepted, samples.length),
    autoConfirmPrecision: fraction(correct, accepted),
    knownAutoConfirmRecall: fraction(correct, known),
    manualFallbackRate: fraction(samples.length - accepted, samples.length),
    unknownFalseAcceptRate: fraction(falseAccept, unknown),
    unknownRejectRate: fraction(unknownRejected, unknown),
    unavailable,
    missingSpecies: perSpecies
      .filter((s) => s.support === 0)
      .map((s) => s.speciesId),
    perSpecies,
    confusion,
    elapsedMs: {
      median: percentile(
        [...rows.values()].map((r) => r.elapsedMs),
        0.5,
      ),
      p95: percentile(
        [...rows.values()].map((r) => r.elapsedMs),
        0.95,
      ),
    },
    note: "精度は自動確定結果を種単位で集計。候補や実行失敗を正解扱いしない。未測定の率はnull。時間は実行環境に依存。",
  };
}
