import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { createServer as createViteServer } from "vite";

const [before, after, model, data, audit, output, engine = "chromium", mode] =
  process.argv.slice(2);
const coverage = mode === "--coverage";
if (!output || !["chromium", "webkit"].includes(engine))
  throw new Error(
    "Usage: node tests/recognition/bench-roster-worker.mjs BASELINE_DIST ROSTER_DIST MODEL DATASET.json AUDIT.json REPORT.json [chromium|webkit] [--coverage]",
  );
const modelSpec = JSON.parse(
  await readFile("src/recognition/bioclip-model.json"),
);
const { manifest, samples } = JSON.parse(await readFile(audit));
const available = (manifest ?? samples).filter(({ split }) => split === "test");
const files = coverage
  ? available
  : [...new Map(available.map((row) => [row.group, row])).values()];
const base = dirname(resolve(data));
if (coverage) {
  for (const { file, downloadSha256 } of files) {
    const digest = createHash("sha256")
      .update(await readFile(join(base, file)))
      .digest("hex");
    if (digest !== downloadSha256)
      throw new Error(`Photo fixture differs: ${file}`);
  }
}
const directories = coverage && before === after ? [after] : [before, after];
const assets = await Promise.all(
  directories.map((directory) => readdir(join(directory, "assets"))),
);
const workers = assets.map((names) =>
  names.find((name) => /^species\.worker-.*\.js$/.test(name)),
);
if (workers.some((file) => !file))
  throw new Error("Build artifacts do not contain species workers");
const types = {
  js: "text/javascript",
  mjs: "text/javascript",
  wasm: "application/wasm",
  jpg: "image/jpeg",
  png: "image/png",
};
const served = new Map([["/model", model]]);
for (const [index, { file }] of files.entries())
  served.set("/photo/" + index, join(base, file));
for (const [index, directory] of directories.entries())
  for (const name of assets[index])
    served.set(`/${index}/assets/${name}`, join(directory, "assets", name));
for (const [index, directory] of directories.entries())
  for (const name of assets[index])
    if (name.endsWith(".wasm") || name.endsWith(".mjs"))
      served.set(`/assets/${name}`, join(directory, "assets", name));

const server = createServer(async (request, response) => {
  if (request.url === "/")
    return response.end("<!doctype html><title>Worker benchmark</title>");
  const file = served.get(request.url);
  if (!file) return response.writeHead(404).end();
  const { size } = await stat(file);
  const type = types[file.split(".").at(-1)] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Length": size, "Content-Type": type });
  createReadStream(file).pipe(response);
});
await new Promise((accept) => server.listen(0, "127.0.0.1", accept));
const browser = await (engine === "webkit" ? webkit : chromium).launch();
try {
  const page = await browser.newPage({ serviceWorkers: "block" });
  page.on("console", (line) => {
    if (line.type() === "warning") console.warn(line.text());
  });
  await page.goto("http://127.0.0.1:" + server.address().port);
  const paths = workers.map((worker, index) => `/${index}/assets/${worker}`);
  const { ready, records } = await page.evaluate(
    async ({ paths, modelSpec, count, coverage }) => {
      const cache = await caches.open(modelSpec.cache);
      await cache.put(modelSpec.cachePath, await fetch("/model"));
      const workers = paths.map((path) => new Worker(path, { type: "module" }));
      function ask(worker, args) {
        const start = performance.now();
        return new Promise((accept, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Species worker timed out")),
            60_000,
          );
          worker.onmessage = ({ data }) => {
            if (data.type === "progress") return;
            clearTimeout(timeout);
            if (data.result.status === "unavailable")
              reject(new Error(data.result.reason));
            else accept({ result: data.result, ms: performance.now() - start });
          };
          worker.onerror = ({ message }) => {
            clearTimeout(timeout);
            reject(new Error(message));
          };
          worker.postMessage(args);
        });
      }
      const ready = [];
      for (const worker of workers) ready.push(await ask(worker, {}));
      const records = [];
      for (let i = 0; i < count; i++) {
        const photo = await (await fetch("/photo/" + i)).blob();
        const timings = [];
        const order = workers.map((_, index) => index);
        if (i % 2) order.reverse();
        if (coverage) {
          const dataURL = await new Promise((accept, reject) => {
            const reader = new FileReader();
            reader.onload = () => accept(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(photo);
          });
          for (const index of order) {
            timings[index] = [];
            for (const fit of ["crop", "contain"])
              timings[index].push(
                await ask(workers[index], { photo: dataURL, fit }),
              );
          }
        } else {
          for (const index of order)
            timings[index] = await ask(workers[index], { photo, fit: "crop" });
        }
        records.push(timings);
      }
      workers.forEach((worker) => worker.terminate());
      return { ready, records };
    },
    { paths, modelSpec, count: files.length, coverage },
  );
  if (coverage) {
    const vite = await createViteServer({
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, ws: false },
    });
    try {
      const { photoSpeciesViews, recognizeSpeciesViews } =
        await vite.ssrLoadModule("/src/recognition/speciesViews.ts");
      const { adoptedAnimals } = await vite.ssrLoadModule(
        "/src/content/adoptedAnimals.ts",
      );
      const reports = [];
      for (const [version, worker] of workers.entries()) {
        const outcomes = [];
        for (const [index, { group, id, file }] of files.entries()) {
          const [crop, contain] = records[index][version];
          const result = await recognizeSpeciesViews(
            photoSpeciesViews(file),
            () => true,
            undefined,
            undefined,
            async (_photo, _progress, fit) =>
              (fit === "contain" ? contain : crop).result,
          );
          outcomes.push({
            id,
            group,
            file,
            candidates: result.referenceGroupId
              ? [result.referenceGroupId]
              : result.candidates.map(({ groupId }) => groupId),
            automatic: result.supported?.groupId,
            views: [crop.result, contain.result],
          });
        }
        const groups = adoptedAnimals.map(({ id, name }) => {
          const group = outcomes.filter((row) => row.group === id);
          const correct = group.filter(({ candidates }) =>
            candidates.includes(id),
          );
          return {
            id,
            name,
            photos: group.length,
            correct: correct.length,
            noCandidate: group.filter(({ candidates }) => !candidates.length)
              .length,
            example: correct[0],
          };
        });
        reports.push({ worker, groups, outcomes });
      }
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        output,
        JSON.stringify({ engine, samples: files.length, reports }, null, 2),
      );
      for (const { worker, groups } of reports) {
        const missing = groups
          .filter(({ correct }) => correct === 0)
          .map(({ name }) => name);
        console.log({
          worker,
          groups: groups.length,
          photos: files.length,
          missing,
        });
        if (missing.length) process.exitCode = 1;
      }
    } finally {
      await vite.close();
    }
  } else {
    const percentile = (numbers, fraction) =>
      [...numbers].sort((a, b) => a - b)[
        Math.ceil(numbers.length * fraction) - 1
      ];
    const versions = workers.map((worker, index) => {
      const samples = records.map((record) => record[index]);
      const times = samples.map(({ ms }) => ms);
      return {
        worker,
        readyMs: ready[index].ms,
        medianMs: percentile(times, 0.5),
        p95Ms: percentile(times, 0.95),
        top1: samples.filter(
          ({ result }, n) => result.candidates?.[0]?.groupId === files[n].group,
        ).length,
        top3: samples.filter(({ result }, n) =>
          result.candidates?.some(({ groupId }) => groupId === files[n].group),
        ).length,
      };
    });
    const report = {
      engine,
      browser: browser.version(),
      samples: files.length,
      versions,
      records: records.map((record, index) => ({
        id: files[index].id,
        group: files[index].group,
        versions: record,
      })),
    };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log({ ...report, records: undefined });
  }
} finally {
  await browser.close();
  server.close();
}
