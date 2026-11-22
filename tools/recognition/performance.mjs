// Measure production artifacts without writing to the app's gallery or relay.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const [buildArg, mirrorArg] = process.argv.slice(2);
if (!buildArg)
  throw Error(
    "Usage: node tools/recognition/performance.mjs BUILD_DIR [CLIP_DIR]",
  );
const build = resolve(buildArg);
const mirror = mirrorArg && resolve(mirrorArg);
const html = await readFile(resolve(build, "index.html"), "utf8");
const base =
  html.match(/src="([^"]*\/)assets\/enhanced-[^"]+\.js"/)?.[1] ?? "/";
const files = await readdir(resolve(build, "assets"));
const worker = (name) =>
  base + "assets/" + files.find((file) => file.startsWith(name + "-"));
const modelName = (await readdir(resolve(build, "models")))
  .find((file) => /^yolox-.*\.onnx(?:\.gz)?$/.test(file))
  ?.replace(/\.gz$/, "");
if (!modelName) throw Error("No YOLOX model in build");
const clipUrl =
  "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/d15189d7028b43f1d3e65039190477f6af591c2a/";
const clipFiles = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "preprocessor_config.json",
  "onnx/model_quantized.onnx",
];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};
const compressed = new Map();
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (path === "/__performance__") {
      response
        .writeHead(200, { "content-type": mime[".html"] })
        .end("<!doctype html><title>Performance</title>");
      return;
    }
    if (path === "/__constrained-worker__.js") {
      response
        .writeHead(200, { "content-type": mime[".js"] })
        .end(
          "Object.defineProperty(navigator,'hardwareConcurrency',{value:2}); await import(" +
            JSON.stringify(worker("species.worker")) +
            "); postMessage({type:'benchmark-ready'});",
        );
      return;
    }
    const isMirror = path.startsWith("/__clip__/");
    const folder = isMirror ? mirror : build;
    if (!folder || (!isMirror && !path.startsWith(base))) {
      response.writeHead(404).end();
      return;
    }
    let relative = path.slice(isMirror ? "/__clip__/".length : base.length);
    if (!relative) relative = "index.html";
    const file = resolve(folder, relative);
    if (!file.startsWith(folder + sep)) {
      response.writeHead(404).end();
      return;
    }
    const suffix = extname(file);
    let useGzip =
      !isMirror &&
      /\bgzip\b/.test(request.headers["accept-encoding"] ?? "") &&
      [".html", ".css", ".js", ".mjs", ".svg", ".wasm", ".onnx"].includes(
        suffix,
      );
    let bytes = compressed.get(file);
    if (!useGzip || !bytes) {
      try {
        bytes = await readFile(file);
        if (useGzip) bytes = gzipSync(bytes, { level: 6 });
      } catch (error) {
        if (isMirror || ![".onnx", ".wasm"].includes(suffix)) throw error;
        // Serve Cloudflare's packaged asset under its canonical URL.
        bytes = await readFile(file + ".gz");
        useGzip = true;
      }
      if (useGzip) compressed.set(file, bytes);
    }
    response
      .writeHead(200, {
        "content-type": mime[suffix] ?? "application/octet-stream",
        "content-length": bytes.length,
        "cache-control": "no-store",
        ...(useGzip ? { "content-encoding": "gzip" } : {}),
      })
      .end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
const median = (list) =>
  [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const round = (n) => Math.round(n * 10) / 10;
let browser;

try {
  await new Promise((yes) => server.listen(0, "127.0.0.1", yes));
  const origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch();
  async function open(constrained) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      return new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    if (constrained) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 });
      });
    }
    return { page, close: () => context.close() };
  }

  const starts = [];
  for (let run = 0; run < 5; run++) {
    const { page, close } = await open(true);
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (!document.querySelector(".design3-start")) return;
        observer.disconnect();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => (window.titleReady = performance.now())),
        );
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(origin + base);
    await page.waitForFunction(() => window.titleReady !== undefined);
    starts.push(
      await page.evaluate(() => {
        const titleMs = window.titleReady;
        const resources = performance
          .getEntriesByType("resource")
          .filter(
            (resource) =>
              new URL(resource.name).origin === location.origin &&
              resource.responseEnd <= titleMs,
          )
          .map((resource) => ({
            name: new URL(resource.name).pathname,
            bytes: resource.transferSize,
          }));
        const navigation = performance.getEntriesByType("navigation")[0];
        resources.push({
          name: location.pathname,
          bytes: navigation.transferSize,
        });
        resources.sort((a, b) => b.bytes - a.bytes);
        return {
          titleMs,
          transferBytes: resources.reduce((sum, item) => sum + item.bytes, 0),
          resources,
        };
      }),
    );
    await close();
  }
  const typical = [...starts].sort((a, b) => a.titleMs - b.titleMs)[2];
  const startup = {
    titleMs: round(typical.titleMs),
    transferBytes: median(starts.map((sample) => sample.transferBytes)),
    resources: typical.resources,
  };

  async function yolo() {
    const { page, close } = await open(true);
    await page.goto(origin + "/__performance__");
    const result = await page.evaluate(
      async ({ script, modelName, modelPath }) => {
        const begin = performance.now();
        const model = await fetch(modelPath);
        if (!model.ok) throw Error("YOLOX model fetch failed");
        const bytes = await model.arrayBuffer();
        const downloadMs = performance.now() - begin;
        const fileName = modelName.replace(/\.onnx$/, "");
        const cache = await caches.open("zooketch-detection-" + fileName);
        await cache.put(modelPath, new Response(bytes));
        const loader = new Worker(script, { type: "module" });
        function run(message, expected, transfer = []) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error(`YOLOX ${message.type} timed out`)),
              30_000,
            );
            loader.onmessage = ({ data }) => {
              if (data.type !== "error" && data.type !== expected) return;
              clearTimeout(timer);
              if (data.type === "error") reject(Error("YOLOX worker error"));
              else resolve();
            };
            loader.onerror = (error) => {
              clearTimeout(timer);
              reject(Error(error.message || "YOLOX worker failed to load"));
            };
            loader.postMessage(message, transfer);
          });
        }
        const started = performance.now();
        await run({ type: "prepare" }, "ready");
        const prepareMs = performance.now() - started;
        const samples = [];
        for (let attempt = 0; attempt < 6; attempt++) {
          const pixels = new Uint8ClampedArray(416 * 416 * 4).fill(128).buffer;
          const sending = performance.now();
          await run(
            { type: "frame", pixels, width: 416, height: 416 },
            "boxes",
            [pixels],
          );
          if (attempt) samples.push(performance.now() - sending);
        }
        loader.terminate();
        return {
          downloadMs,
          prepareMs,
          inferenceMs: samples.sort((a, b) => a - b)[2],
        };
      },
      {
        script: worker("live.worker"),
        modelName,
        modelPath: base + "models/" + modelName,
      },
    );
    await close();
    return result;
  }
  const yoloSamples = [];
  for (let repeat = 0; repeat < 3; repeat++) yoloSamples.push(await yolo());
  const yolox = Object.fromEntries(
    Object.keys(yoloSamples[0]).map((name) => [
      name,
      round(median(yoloSamples.map((sample) => sample[name]))),
    ]),
  );

  async function clip(constrained) {
    const { page, close } = await open(constrained);
    const logging = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error")
        logging.push(message.text());
    });
    try {
      await page.goto(origin + "/__performance__");
      const result = await page.evaluate(
        async ({ script, clipFiles, clipUrl, photoPath, constrained }) => {
          const cache = await caches.open("transformers-cache");
          await Promise.all(
            clipFiles.map(async (file) => {
              const response = await fetch("/__clip__/" + file);
              if (!response.ok)
                throw Error("Missing pinned CLIP model file: " + file);
              // A synthetic direct cache response also normalizes the response URL.
              await cache.put(clipUrl + file, response);
            }),
          );
          const image = await fetch(photoPath);
          if (!image.ok) throw Error("Unavailable benchmark photo");
          const blob = await image.blob();
          const photo = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const begin = performance.now();
          const workerScript = constrained
            ? "/__constrained-worker__.js"
            : script;
          const worker = new Worker(workerScript, { type: "module" });
          if (constrained)
            await new Promise((resolve, reject) => {
              const timer = setTimeout(
                () =>
                  reject(Error("Constrained CLIP worker failed to initialize")),
                30_000,
              );
              worker.onmessage = ({ data }) => {
                if (data.type !== "benchmark-ready") return;
                clearTimeout(timer);
                resolve();
              };
              worker.onerror = (error) => {
                clearTimeout(timer);
                reject(
                  Error(
                    error.message || "Constrained CLIP worker failed to load",
                  ),
                );
              };
            });
          function run(photo) {
            return new Promise((resolve, reject) => {
              const timer = setTimeout(
                () =>
                  reject(
                    Error(`CLIP ${photo ? "inference" : "prepare"} timed out`),
                  ),
                90_000,
              );
              worker.onmessage = ({ data }) => {
                if (data.type !== "result") return;
                clearTimeout(timer);
                if (data.result.status === "unavailable")
                  reject(Error(data.result.reason));
                else resolve(data.result);
              };
              worker.onerror = (error) => {
                clearTimeout(timer);
                reject(Error(error.message || "CLIP worker failed to load"));
              };
              worker.postMessage({ photo });
            });
          }
          await run();
          const prepareMs = performance.now() - begin;
          const runs = [];
          for (let attempt = 0; attempt < 3; attempt++) {
            const started = performance.now();
            const result = await run(photo);
            if (!["candidates", "unknown"].includes(result.status))
              throw Error("Missing classification result");
            runs.push(performance.now() - started);
          }
          worker.terminate();
          return {
            prepareMs,
            inferenceMs: [...runs].sort((a, b) => a - b)[1],
            firstPhotoMs: runs[0],
          };
        },
        {
          script: worker("species.worker"),
          clipFiles,
          clipUrl,
          constrained,
          photoPath: base + "replica-assets/giraffe-example.png",
        },
      );
      return Object.fromEntries(
        Object.entries(result).map(([key, value]) => [key, round(value)]),
      );
    } catch (error) {
      if (logging.length) console.error(logging.join("\n"));
      throw error;
    } finally {
      await close();
    }
  }
  const actualClip = mirror
    ? { normal: await clip(false), constrained: await clip(true) }
    : undefined;
  console.log(JSON.stringify({ startup, yolox, clip: actualClip }, null, 2));
} finally {
  await browser?.close();
  await new Promise((yes) => server.close(yes));
}
