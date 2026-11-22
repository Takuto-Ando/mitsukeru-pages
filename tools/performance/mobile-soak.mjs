import { appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const [rawBase, output, rawMinutes = "30", rawLiveSeconds = "50"] =
  process.argv.slice(2);
if (!rawBase || !output)
  throw Error(
    "Usage: node tools/performance/mobile-soak.mjs URL OUTPUT.jsonl [minutes] [live seconds per cycle]",
  );
const base = new URL(rawBase);
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
  throw Error("The soak uses local production builds only");
const duration = Number(rawMinutes) * 60_000;
const liveDuration = Number(rawLiveSeconds) * 1000;
if (!(duration > 0 && liveDuration >= 0)) throw Error("Invalid duration");

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
    window.soak = { created: 0, closed: 0, frames: 0, tracks: 0, stopped: 0 };
    window.Worker = new Proxy(window.Worker, {
      construct(target, args) {
        const worker = Reflect.construct(target, args);
        if (args[1]?.name !== "zooketch-live-detection") return worker;
        window.soak.created++;
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          window.soak.closed++;
          terminate();
        };
        worker.addEventListener("message", ({ data }) => {
          if (data.type === "boxes") window.soak.frames++;
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
  await page.goto(base.href, { waitUntil: "domcontentloaded" });
  const resume = button("つづきから");
  await resume.waitFor({ timeout: 20_000 });
  const usesLogin = (await resume.getAttribute("aria-haspopup")) === "dialog";
  await (usesLogin ? button("はじめから") : resume).tap({ timeout: 20_000 });
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
    if (!cycles) await monitor("live");
    if (liveDuration)
      await new Promise((resolve) => setTimeout(resolve, liveDuration));
    await button("シャッター").tap();
    await page.getByRole("heading", { name: "キリン", exact: true }).waitFor();
    await button("ピツネに見せる").tap();
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
    for (let k = 0; k < 20; k++) {
      const t = k / 19;
      await page.mouse.move(
        box.x + ((315 + 245 * (0.2 + 0.6 * t)) / 600) * box.width,
        box.y +
          ((255 + 125 * (0.25 + 0.5 * Math.sin(t * Math.PI))) / 600) *
            box.height,
      );
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
