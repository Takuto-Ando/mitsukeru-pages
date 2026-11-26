import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const [rawBase, output, rawMinutes = "30", rawLiveSeconds = "50", modelPath] =
  process.argv.slice(2);
if (!rawBase || !output || !modelPath)
  throw Error(
    "Usage: node tools/performance/mobile-soak.mjs URL OUTPUT.jsonl MINUTES LIVE_SECONDS /LOCAL-BIOCLIP.onnx",
  );
const base = new URL(rawBase);
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
  throw Error("The soak uses local production builds only");
const duration = Number(rawMinutes) * 60_000;
const liveDuration = Number(rawLiveSeconds) * 1000;
if (!(duration > 0 && liveDuration >= 0)) throw Error("Invalid duration");

const model = JSON.parse(
  await readFile("src/recognition/bioclip-model.json", "utf8"),
);
const modelUrl = new URL(modelPath, base);
if (modelUrl.origin !== base.origin)
  throw Error("Serve the model from the same local origin as the app");
const browser = await chromium.launch();

let page;
let passed = false;
const started = performance.now();
const log = (entry) => {
  const line = JSON.stringify({
    elapsedSeconds: Math.round((performance.now() - started) / 100) / 10,
    ...entry,
  });
  appendFileSync(output, line + "\n");
  console.log(line);
};
try {
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  let accepted = 0;
  const acceptedIds = new Set();
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base.origin) return route.abort();
    if (url.pathname === "/__soak/prime")
      return route.fulfill({
        contentType: "text/html",
        body: "<title>Local model fixture</title>",
      });
    if (request.method() === "GET") return route.continue();
    if (!url.pathname.endsWith("/__zooketch-share")) return route.abort();
    const { id } = request.postDataJSON();
    accepted++;
    acceptedIds.add(id);
    return route.fulfill({ status: 204 });
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    window.soak = {
      created: 0,
      closed: 0,
      frames: 0,
      tracks: 0,
      stopped: 0,
      speciesCreated: 0,
      speciesClosed: 0,
      speciesResults: 0,
    };
    window.Worker = new Proxy(window.Worker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args);
        const detector = args[1]?.name === "zooketch-live-detection";
        const species = args[1]?.name === "zooketch-species-recognition";
        if (!detector && !species) return worker;
        if (detector) window.soak.created++;
        else window.soak.speciesCreated++;
        let closed = false;
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          if (closed) return;
          closed = true;
          if (detector) window.soak.closed++;
          else window.soak.speciesClosed++;
          terminate();
        };
        worker.addEventListener("message", ({ data }) => {
          if (detector && data.type === "boxes") window.soak.frames++;
          if (
            species &&
            data.type === "result" &&
            data.result.status !== "ready"
          )
            window.soak.speciesResults++;
        });
        return worker;
      },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        async getUserMedia() {
          const image = new Image();
          image.src = new URL(
            "replica-assets/giraffe-example.png",
            location.href,
          ).href;
          await image.decode();
          const source = document.createElement("canvas");
          source.width = 640;
          source.height = 480;
          const ctx = source.getContext("2d");
          const draw = () => ctx.drawImage(image, 0, 0, 640, 480);
          draw();
          const stream = source.captureStream(8);
          const timer = setInterval(draw, 125);
          for (const track of stream.getTracks()) {
            window.soak.tracks++;
            const stop = track.stop.bind(track);
            let stopped = false;
            track.stop = () => {
              if (!stopped) window.soak.stopped++;
              stopped = true;
              clearInterval(timer);
              stop();
            };
          }
          return stream;
        },
      },
    });
  });

  const cdp = await page.context().newCDPSession(page);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const wait = (name) => button(name).waitFor({ timeout: 20_000 });
  const screen = (name) => page.locator(`.replica-app[data-screen="${name}"]`);
  await page.goto(new URL("/__soak/prime", base).href);
  await page.evaluate(
    async ({ cache, cachePath, bytes, modelUrl }) => {
      const response = await fetch(modelUrl);
      if (
        !response.ok ||
        Number(response.headers.get("Content-Length")) !== bytes
      )
        throw Error("Could not prime the model fixture");
      await (await caches.open(cache)).put(cachePath, response);
    },
    { ...model, modelUrl: modelUrl.href },
  );
  await page.goto(base.href, { waitUntil: "domcontentloaded" });
  const resume = button("つづきから");
  await resume.waitFor({ timeout: 20_000 });
  await resume.tap({ timeout: 20_000 });
  let cycles = 0;
  const monitor = async (label) => {
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const dom = await cdp.send("Memory.getDOMCounters");
    log({
      label,
      cycles,
      accepted,
      unique: acceptedIds.size,
      jsHeapMiB: +(heap.usedSize / 1048576).toFixed(2),
      backingMiB: +(heap.backingStorageSize / 1048576).toFixed(2),
      domNodes: dom.nodes,
      ...(await page.evaluate(() => ({ ...window.soak }))),
      pageErrors: pageErrors.length,
    });
  };
  do {
    await page.locator(".replica-camera-tracking").waitFor({ timeout: 60_000 });
    await page
      .getByText("キリンがいるよ！", { exact: true })
      .first()
      .waitFor({ timeout: 45_000 });
    if (!cycles) await monitor("live");
    if (liveDuration)
      await new Promise((resolve) => setTimeout(resolve, liveDuration));
    await button("シャッター").tap();
    await page.getByRole("heading", { name: "キリン", exact: true }).waitFor();
    await button("描いてもらう").tap();
    // Explicit steps keep the run independent of animation-timer scheduling.
    await screen("easel").or(screen("challenge")).or(screen("draw")).waitFor();
    if (await screen("easel").count())
      await button("スケッチの準備を確認してつぎへ").evaluate((element) =>
        element.click(),
      );
    await screen("challenge").or(screen("draw")).waitFor();
    if (await screen("challenge").count())
      await button("課題を確認してつぎへ").evaluate((element) =>
        element.click(),
      );
    const canvas = page.getByTestId("canvas");
    await canvas.waitFor({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    if (!box) throw Error("Missing canvas");
    const tonguePoint = (t) => [
      box.x + ((315 + 245 * (0.2 + 0.6 * t)) / 600) * box.width,
      box.y +
        ((255 + 125 * (0.25 + 0.5 * Math.sin(t * Math.PI))) / 600) * box.height,
    ];
    for (const t of [0, 1]) await page.mouse.click(...tonguePoint(t));
    for (let k = 0; k < 20; k++) {
      await page.mouse.move(...tonguePoint(k / 19));
      if (k === 0) await page.mouse.down();
    }
    await page.mouse.up();
    await button("できた！").tap();
    await wait("写真を撮る");
    await button("写真を撮る").tap();
    cycles++;
    await wait("シャッター");
    if (pageErrors.length) throw Error(pageErrors.join("; "));
    await monitor("saved");
  } while (performance.now() - started < duration);
  await button("ギャラリー").tap();
  await page
    .getByRole("button", { name: "キリンのスケッチを見る", exact: true })
    .last()
    .waitFor();
  const cards = await page
    .getByRole("button", { name: "キリンのスケッチを見る", exact: true })
    .count();
  const resources = await page.evaluate(() => ({ ...window.soak }));
  if (
    cards !== cycles ||
    acceptedIds.size !== cycles ||
    accepted !== cycles ||
    resources.created !== resources.closed ||
    resources.speciesCreated !== resources.speciesClosed ||
    resources.speciesResults < cycles ||
    resources.tracks !== resources.stopped
  )
    throw Error(
      "Mismatch " +
        JSON.stringify({
          cycles,
          cards,
          accepted,
          unique: acceptedIds.size,
          resources,
        }),
    );
  await monitor("gallery");
  log({ status: "passed", cycles, cards, accepted });
  passed = true;
} catch (error) {
  const diagnostics = await page
    ?.evaluate(() => ({
      screen: document.querySelector(".replica-app")?.dataset.screen,
      alerts: [...document.querySelectorAll('[role="alert"]')].map(
        (node) => node.textContent,
      ),
      ...window.soak,
    }))
    .catch(() => undefined);
  log({ status: "failed", error: String(error), ...diagnostics });
} finally {
  await browser.close();
}
if (!passed) process.exitCode = 1;
