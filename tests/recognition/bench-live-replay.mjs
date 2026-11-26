// Compare app camera bubbles using the same video files and the real workers.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const [build, manifestPath, modelFile, output, ...selectedIds] =
  process.argv.slice(2);
if (!output)
  throw new Error(
    "Usage: node tests/recognition/bench-live-replay.mjs DIST VIDEO_MANIFEST.json BIOCLIP.onnx REPORT.json [clip IDs]",
  );
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const clips = manifest.filter(
  ({ id }) => !selectedIds.length || selectedIds.includes(id),
);
if (!clips.length) throw new Error("No video fixtures matched");
const model = JSON.parse(
  await readFile("src/recognition/bioclip-model.json", "utf8"),
);
const root = resolve(build);
const videos = dirname(resolve(manifestPath));
for (const { id, sha256 } of clips) {
  const contents = await readFile(resolve(videos, id + ".mp4"));
  const actual = createHash("sha256").update(contents).digest("hex");
  if (sha256 && actual !== sha256)
    throw new Error(
      `The replay file ${id}.mp4 differs from the fixture manifest`,
    );
}
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
};
const serve = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/__replay/prime") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<!doctype html><title>Local video replay</title>");
  }
  const file =
    path === "/__replay/model"
      ? resolve(modelFile)
      : path.startsWith("/__replay/videos/")
        ? resolve(videos, path.split("/").at(-1))
        : path.startsWith("/models/")
          ? resolve("public", "." + path)
          : resolve(root, "." + (path === "/" ? "/index.html" : path));
  if (
    file !== resolve(modelFile) &&
    ![root, videos, resolve("public/models")].some((parent) =>
      file.startsWith(parent + sep),
    )
  ) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const { size } = await stat(file);
    const type = types[extname(file)] ?? "application/octet-stream";
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": end - start + 1,
      });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": type, "Content-Length": size });
      createReadStream(file).pipe(res);
    }
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => serve.listen(0, "127.0.0.1", done));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const origin = "http://127.0.0.1:" + serve.address().port;
  const prime = await context.newPage();
  await prime.goto(origin + "/__replay/prime");
  await prime.evaluate(async ({ cache, cachePath }) => {
    const response = await fetch("/__replay/model");
    if (!response.ok) throw new Error("Missing local image model");
    await (await caches.open(cache)).put(cachePath, response);
  }, model);
  await prime.close();

  const results = [];
  const durationMs = Number(process.env.REPLAY_WINDOW_MS) || 11500;
  for (const clip of clips) {
    const page = await context.newPage();
    try {
      await page.addInitScript(({ id, startSeconds = 0 }) => {
        window.replay = { events: [], views: [], detection: [], boxes: 0 };
        const RawWorker = window.Worker;
        window.Worker = class extends RawWorker {
          constructor(url, options) {
            super(url, options);
            if (options?.name === "zooketch-live-detection") {
              this.addEventListener("message", ({ data }) => {
                if (window.replay.start !== undefined && data.boxes?.length)
                  window.replay.detection.push({
                    ms: Math.round(performance.now() - window.replay.start),
                    boxes: data.boxes.map(({ label, score }) => ({
                      label,
                      score,
                    })),
                  });
              });
              return;
            }
            if (options?.name !== "zooketch-species-recognition") return;
            this.addEventListener("message", ({ data }) => {
              if (data.result?.status === "ready") window.replay.warm = true;
              if (window.replay.start !== undefined && data.type === "result")
                window.replay.views.push({
                  ms: Math.round(performance.now() - window.replay.start),
                  candidates: data.result?.candidates?.slice(0, 2),
                  status:
                    data.result?.recognition?.status ?? data.result?.status,
                });
            });
          }
        };
        let last;
        function recordBubble() {
          const state = window.replay;
          const bubble = document
            .querySelector(".pitsune-bubble")
            ?.textContent?.trim();
          if (!bubble || last === bubble || state.start === undefined) return;
          last = bubble;
          state.boxes += Number(
            !!document.querySelector(".replica-camera-tracking"),
          );
          state.events.push({
            ms: Math.round(performance.now() - state.start),
            videoTime: state.input?.currentTime,
            text: bubble,
          });
        }
        new MutationObserver(recordBubble).observe(document, {
          subtree: true,
          childList: true,
          characterData: true,
        });
        let stream;
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            async getUserMedia() {
              if (stream?.active) return stream;
              const video = document.createElement("video");
              video.src = "/__replay/videos/" + id + ".mp4";
              video.muted = true;
              video.playsInline = true;
              video.loop = true;
              await new Promise((done, fail) => {
                video.addEventListener("loadeddata", done, { once: true });
                video.addEventListener("error", fail, { once: true });
                video.load();
              });
              if (startSeconds) video.currentTime = startSeconds;
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              stream = canvas.captureStream(15);
              function draw() {
                if (!stream.active) return;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                video.requestVideoFrameCallback(draw);
              }
              await video.play();
              window.replay.start = performance.now();
              window.replay.input = video;
              draw();
              recordBubble();
              return stream;
            },
          },
        });
      }, clip);
      await page.goto(origin + "/");
      await page.waitForFunction(() => window.replay?.warm, null, {
        timeout: 20000,
      });
      await page
        .getByRole("button", { name: "つづきから", exact: true })
        .click();
      await page.waitForFunction(
        () => window.replay.start !== undefined,
        null,
        { timeout: 10000 },
      );
      await page.waitForFunction(
        (ms) => performance.now() - window.replay.start >= ms,
        durationMs,
        { timeout: durationMs + 4000 },
      );
      const state = await page.evaluate(() => {
        const { input, ...state } = window.replay;
        return {
          ...state,
          finalVideoTime: input.currentTime,
          visible: document.querySelector(".replica-camera-tracking") !== null,
        };
      });
      const named = state.events.filter(({ text }) =>
        /(?:かも！|がいるよ！)$/.test(text),
      );
      const counts = (suffix) => {
        const events = named.filter(({ text }) => text.endsWith(suffix));
        const matches = events.filter(
          ({ text }) => text === clip.name + suffix,
        );
        return {
          correct: matches.length,
          wrong: events.length - matches.length,
          firstCorrectMs: matches[0]?.ms ?? null,
        };
      };
      const displayedMs = { correct: 0, wrong: 0 };
      for (const [index, event] of state.events.entries()) {
        const name = event.text.replace(/(?:かも！|がいるよ！)$/, "");
        if (name === event.text) continue;
        const next = state.events[index + 1]?.ms ?? durationMs;
        displayedMs[name === clip.name ? "correct" : "wrong"] += Math.max(
          0,
          Math.min(durationMs, next) - event.ms,
        );
      }
      const item = {
        id: clip.id,
        expected: clip.name,
        tentative: counts("かも！"),
        confirmed: counts("がいるよ！"),
        displayedMs,
        ...state,
      };
      results.push(item);
      console.log(JSON.stringify(item));
    } finally {
      await page.close();
    }
  }
  await writeFile(
    output,
    JSON.stringify(
      { durationMs, browser: browser.version(), results },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  serve.close();
}
