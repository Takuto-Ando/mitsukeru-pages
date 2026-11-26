import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const [before, after, model, data, audit, output, engine = "chromium"] =
  process.argv.slice(2);
if (!output || !["chromium", "webkit"].includes(engine))
  throw new Error(
    "Usage: node tests/recognition/bench-roster-worker.mjs BASELINE_DIST ROSTER_DIST MODEL DATASET.json AUDIT.json REPORT.json [chromium|webkit]",
  );
const modelSpec = JSON.parse(
  await readFile("src/recognition/bioclip-model.json"),
);
const { manifest } = JSON.parse(await readFile(audit));
const available = manifest.filter(({ split }) => split === "test");
const files = [...new Map(available.map((row) => [row.group, row])).values()];
const base = dirname(resolve(data));
const directories = [before, after];
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
    async ({ paths, modelSpec, count }) => {
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
        const order = i % 2 ? [1, 0] : [0, 1];
        for (const index of order)
          timings[index] = await ask(workers[index], { photo, fit: "crop" });
        records.push(timings);
      }
      workers.forEach((worker) => worker.terminate());
      return { ready, records };
    },
    { paths, modelSpec, count: files.length },
  );
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
} finally {
  await browser.close();
  server.close();
}
