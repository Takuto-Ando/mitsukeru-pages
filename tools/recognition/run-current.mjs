// Developer-only evaluation. Does not change app labels, thresholds or model code.
import { chromium } from "@playwright/test";
import { readFile, readdir, writeFile, access } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { loadDataset, evaluate } from "./evaluation.mjs";
const [manifestPath, origin, outputPath] = process.argv.slice(2);
let browser;
try {
  if (!manifestPath || !origin || !outputPath)
    throw Error(
      "使い方: node tools/recognition/run-current.mjs DATASET.json http://127.0.0.1:4176/mitsukeru-pages/ NEW_PREDICTIONS.json",
    );
  const url = new URL(origin);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw Error("ローカルの公開用preview URLを指定してください");
  try {
    await access(outputPath);
    throw Error("出力先が存在します。別のファイル名を指定してください");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const dataset = await loadDataset(manifestPath);
  const samples = dataset.manifest.samples.filter((s) => s.split === "test");
  if (!samples.length)
    throw Error("test画像がありません。モデルを取得せず終了しました");
  const workerFile = (await readdir("dist/assets")).find((name) =>
    /^species\.worker-.*\.js$/.test(name),
  );
  if (!workerFile) throw Error("先に公開用baseでnpm run buildしてください");
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url.href);
  await page.getByRole("heading").first().waitFor();
  // One prepared worker, sequential photos; no parallel sessions or model copies.
  const started = performance.now();
  await page.evaluate(async (workerFile) => {
    const w = new Worker(new URL("assets/" + workerFile, document.baseURI), {
      type: "module",
    });
    window.labWorker = w;
    window.labRun = (photo) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          w.terminate();
          reject(Error("推論がタイムアウトしました"));
        }, 240000);
        w.onerror = (e) => {
          clearTimeout(timer);
          reject(Error(e.message));
        };
        w.onmessage = (e) => {
          if (e.data.type === "result") {
            clearTimeout(timer);
            resolve(e.data.result);
          }
        };
        w.postMessage(photo ? { photo } : {});
      });
    const ready = await window.labRun();
    if (ready.status !== "ready") throw Error("モデルの準備に失敗しました");
  }, workerFile);
  const prepareMs = performance.now() - started,
    results = [];
  let model;
  for (const sample of samples) {
    const { file, mime } = dataset.files.get(sample.id);
    const photo = `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
    const prediction = await page.evaluate(async (photo) => {
      const started = performance.now();
      const result = await window.labRun(photo);
      const r = result.recognition;
      return {
        status:
          result.status === "unavailable"
            ? "unavailable"
            : r?.status || "unknown",
        speciesId: r?.speciesId || null,
        elapsedMs: performance.now() - started,
        model: r?.modelVersion || null,
      };
    }, photo);
    if (prediction.model) {
      if (model && model !== prediction.model)
        throw Error("同じ実行に異なるモデル版が混入しました");
      model = prediction.model;
    }
    results.push({ id: sample.id, ...prediction });
    console.log(
      `${sample.id}: ${prediction.status} ${prediction.speciesId || "-"} (${Math.round(prediction.elapsedMs)}ms)`,
    );
  }
  const output = {
    version: 1,
    model: model || "current-worker-unavailable",
    prepareMs,
    environment: {
      browser: "Playwright Chromium",
      measuredAt: new Date().toISOString(),
    },
    results,
  };
  evaluate(dataset.manifest, output); // Validate output before saving; never hide failed images.
  await writeFile(outputPath, JSON.stringify(output, null, 2), { flag: "wx" });
  console.log(
    `推論結果を保存しました: ${outputPath}（写真・パスは含みません）`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
