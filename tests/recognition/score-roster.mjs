import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createServer } from "vite";

const [featuresFile, reportFile, ...bankFiles] = process.argv.slice(2);
if (!featuresFile || !reportFile)
  throw new Error(
    "Usage: node tests/recognition/score-roster.mjs FEATURES.jsonl REPORT.json [candidate-bank.json ...]",
  );

const read = (path) => readFile(path, "utf8");
const dimensions = 512;
const photos = (await read(featuresFile)).trim().split("\n").map(JSON.parse);
const baselineFile = "src/recognition/bioclip-labels.json";
const referenceBank = JSON.parse(
  await read("src/recognition/bioclip-photo-references.json"),
);
const archive = process.env.ZOOKETCH_ROSTER_BASELINE;
if (!archive && !bankFiles.length)
  throw new Error("Specify candidate banks or set ZOOKETCH_ROSTER_BASELINE");
const serverOptions = {
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false },
};
const vite = await createServer(serverOptions);
const baselineVite = archive
  ? await createServer({
      ...serverOptions,
      root: resolve(archive),
    })
  : undefined;

function loadBank(raw) {
  const start = performance.now();
  const { labels, vectors } = JSON.parse(raw);
  const quantized = Int8Array.from(atob(vectors), (character) =>
    character.charCodeAt(0),
  );
  const bank = labels.map((label, index) => {
    const vector = quantized.subarray(
      index * dimensions,
      (index + 1) * dimensions,
    );
    let squareSum = 0;
    for (const value of vector) squareSum += value ** 2;
    return { label, vector, norm: Math.sqrt(squareSum) };
  });
  return { bank, ms: performance.now() - start };
}

function rescore(bank, feature) {
  return bank.map(({ label, vector, norm }) => {
    let dot = 0;
    for (let i = 0; i < dimensions; i++) dot += feature[i] * vector[i];
    return { label, cosine: dot / norm };
  });
}

const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
};

function summary(rows) {
  const byGroup = {};
  const byTaxon = {};
  let top1 = 0,
    top3 = 0,
    wrong = 0,
    autoCorrect = 0,
    autoWrong = 0;
  for (const { group, species, result, automatic } of rows) {
    const ids = result.map((entry) => entry.groupId);
    const first = ids[0];
    top1 += Number(first === group);
    top3 += Number(ids.includes(group));
    wrong += Number(Boolean(first) && first !== group);
    autoCorrect += Number(automatic === group);
    autoWrong += Number(Boolean(automatic) && automatic !== group);
    for (const [table, key] of [
      [byGroup, group],
      [byTaxon, species],
    ]) {
      const stats = (table[key] ??= { n: 0, top1: 0, top3: 0, confusions: {} });
      stats.n++;
      stats.top1 += Number(first === group);
      stats.top3 += Number(ids.includes(group));
      if (first !== group) {
        const outcome = first || "no-candidate";
        stats.confusions[outcome] = 1 + (stats.confusions[outcome] ?? 0);
      }
    }
  }
  return {
    n: rows.length,
    top1,
    top3,
    wrong,
    noCandidate: rows.length - top1 - wrong,
    autoCorrect,
    autoWrong,
    byGroup,
    byTaxon,
  };
}

try {
  const { classifyBioClip } =
    (await baselineVite?.ssrLoadModule("/src/recognition/labels.ts")) ?? {};
  const { classifyRosterBioClip } = bankFiles.length
    ? await vite.ssrLoadModule("/src/recognition/rosterClassifier.ts")
    : {};
  const groupPhotoReferences = bankFiles.length
    ? (await vite.ssrLoadModule("/src/recognition/rosterPhotoReferences.ts"))
        .groupPhotoReferences
    : undefined;
  const { createPhotoReferenceMatcher } = await vite.ssrLoadModule(
    "/src/recognition/photoReferenceMatcher.ts",
  );
  const { recognizeSpeciesViews, photoSpeciesViews } = await vite.ssrLoadModule(
    "/src/recognition/speciesViews.ts",
  );
  const { adoptedAnimalById, adoptedAnimals } = await vite.ssrLoadModule(
    "/src/content/adoptedAnimals.ts",
  );
  const matcher = createPhotoReferenceMatcher(referenceBank);
  const rosterMatcher = bankFiles.length
    ? createPhotoReferenceMatcher(
        JSON.parse(
          await read("src/recognition/bioclip-photo-references-30.json"),
        ),
      )
    : undefined;
  const coverage = Object.fromEntries(
    [...adoptedAnimalById].map(([id]) => [
      id,
      referenceBank.speciesIds.filter((value) => value === id).length,
    ]),
  );
  const variants = {};
  const byPhoto = (rows) =>
    Object.fromEntries(
      ["validation", "test"].map((split) => [
        split,
        summary(rows.filter((row) => row.split === split)),
      ]),
    );

  for (const path of [...(archive ? [baselineFile] : []), ...bankFiles]) {
    const raw = await read(path);
    const { bank } = loadBank(raw);
    for (let i = 0; i < 20; i++) loadBank(raw);
    const parseMs = distribution(
      Array.from({ length: 100 }, () => loadBank(raw).ms),
    );
    const usesBaseline = Boolean(archive) && path === baselineFile;
    const classify = usesBaseline ? classifyBioClip : classifyRosterBioClip;
    if (!classify)
      throw new Error(
        "Build candidate classifier before testing candidate banks",
      );
    const ranked = photos.map((photo) => ({
      ...photo,
      views: Object.fromEntries(
        Object.entries(photo.views).map(([key, view]) => {
          const feature = Float32Array.from(view.embedding);
          const start = performance.now();
          const output = rescore(bank, feature);
          const ms = performance.now() - start;
          const match = usesBaseline
            ? (ids) => matcher(feature, ids)
            : (ids) => groupPhotoReferences(rosterMatcher, feature, ids);
          return [key, { output, match, ms }];
        }),
      ),
    }));
    const cases = JSON.parse(process.env.ZOOKETCH_ROSTER_CASES || "[null]");
    const results = {};
    for (const policy of usesBaseline ? [null] : cases) {
      const modes = {};
      for (const mode of [
        "crop",
        "contain",
        "wide",
        "crop+contain",
        "contain+crop",
        "wide+contain",
        ...(!usesBaseline ? ["photo-review"] : []),
      ]) {
        const outcomes = [];
        const photoReview = mode === "photo-review";
        const [firstMode, secondMode] = (
          photoReview ? "crop+contain" : mode
        ).split("+");
        for (const photo of ranked) {
          const classifyView = (key) => {
            const { output, match } = photo.views[key];
            return classify(
              output,
              match,
              photoReview
                ? { ...policy, allowReferenceSuggestion: true }
                : (policy ?? undefined),
            );
          };
          let result, automatic;
          if (secondMode) {
            const views = photoSpeciesViews(firstMode);
            const decision = await recognizeSpeciesViews(
              views,
              () => true,
              undefined,
              undefined,
              async (_photo, _progress, fit) => {
                const response = classifyView(
                  fit === "contain" ? secondMode : firstMode,
                );
                return {
                  status: response.candidates.length ? "candidates" : "unknown",
                  ...response,
                };
              },
            );
            result =
              photoReview && decision.referenceGroupId
                ? [{ groupId: decision.referenceGroupId }]
                : decision.candidates;
            automatic = decision.supported?.groupId;
          } else {
            const decision = classifyView(firstMode);
            result = decision.candidates;
            automatic =
              decision.recognition.status === "identified"
                ? result[0]?.groupId
                : undefined;
          }
          outcomes.push({
            group: photo.group,
            species: photo.species,
            split: photo.split,
            result,
            automatic,
          });
        }
        modes[mode] = byPhoto(outcomes);
      }
      results[JSON.stringify(policy)] = modes;
    }
    variants[path] = {
      bytes: Buffer.byteLength(raw),
      vectors: bank.length,
      parseMs,
      results,
      dotProductMs: distribution(
        ranked.flatMap(({ views }) => Object.values(views).map(({ ms }) => ms)),
      ),
    };
  }
  const timing = Object.fromEntries(
    Object.keys(photos[0].views).map((view) => [
      view,
      distribution(photos.map((photo) => photo.views[view].ms)),
    ]),
  );
  const manifest = photos.map(({ views, ...photo }) => photo);
  const missing = adoptedAnimals
    .filter(({ id }) => !photos.some(({ group }) => group === id))
    .map(({ id }) => id);
  await writeFile(
    reportFile,
    JSON.stringify(
      { total: photos.length, missing, coverage, timing, manifest, variants },
      null,
      2,
    ),
  );
  for (const [path, { bytes, vectors, parseMs, results }] of Object.entries(
    variants,
  )) {
    console.log(path, bytes, vectors, parseMs);
    for (const [policy, modes] of Object.entries(results))
      for (const [mode, splits] of Object.entries(modes)) {
        const compact = Object.fromEntries(
          Object.entries(splits).map(
            ([split, { byGroup, byTaxon, ...counts }]) => [split, counts],
          ),
        );
        console.log(
          policy,
          mode,
          JSON.stringify(
            process.env.ZOOKETCH_ROSTER_VALIDATION
              ? compact.validation
              : compact,
          ),
        );
      }
  }
} finally {
  await baselineVite?.close();
  await vite.close();
}
