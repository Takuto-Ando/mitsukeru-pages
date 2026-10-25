// Optional real-model integration check. Downloads model weights; not part of offline CI.
import { chromium } from "@playwright/test";
import { readdir } from "node:fs/promises";
const origin = process.env.MODEL_TEST_URL || "http://127.0.0.1:4175/";
const files = await readdir("dist/assets");
const workerFile = files.find((name) => /^species\.worker-.*\.js$/.test(name));
if (!workerFile) throw Error("Run npm run build first");
const goatResponse = await fetch(
  "https://zoo.city.kyoto.lg.jp/zoo/uploads/image/img296-1024x768.jpg",
  { signal: AbortSignal.timeout(20000) },
);
if (!goatResponse.ok) throw Error("Kyoto Zoo test photograph unavailable");
const goatPhoto =
  "data:image/jpeg;base64," +
  Buffer.from(await goatResponse.arrayBuffer()).toString("base64");
const browser = await chromium.launch();
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  page.on("console", (message) => console.log(message.text()));
  await page.goto(origin);
  const result = await page.evaluate(
    async ({ workerFile, goatPhoto }) => {
      const url =
        "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg";
      await navigator.serviceWorker.ready;
      const response = await fetch(url);
      if (!response.ok) throw Error("Test photograph unavailable");
      const blob = await response.blob();
      const photo = await new Promise((resolve) => {
        const f = new FileReader();
        f.onload = () => resolve(f.result);
        f.readAsDataURL(blob);
      });
      const worker = new Worker(
        new URL("assets/" + workerFile, document.baseURI),
        { type: "module" },
      );
      const run = (input = photo) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("Model check timed out")),
            240000,
          );
          worker.onerror = (e) => {
            clearTimeout(timer);
            reject(Error(e.message));
          };
          worker.onmessage = (e) => {
            if (e.data.type === "result") {
              clearTimeout(timer);
              resolve(e.data.result);
            }
          };
          worker.postMessage({ photo: input });
        });
      const result = await run();
      const goatResult = await run(goatPhoto);
      worker.terminate();
      return {
        result,
        goatResult,
        photoBytes: blob.size,
        caches: await caches.keys(),
      };
    },
    { workerFile, goatPhoto },
  );
  console.log(JSON.stringify(result));
  if (result.result.status === "unavailable")
    throw Error("Real browser model failed to initialize");
  if (result.result.status !== "unknown")
    throw Error("Out-of-scope tiger was not rejected");
  if (
    result.goatResult.status !== "candidates" ||
    result.goatResult.candidates[0]?.groupId !== "goat"
  )
    throw Error(
      "Goat test photograph was not identified as a goat/sheep candidate",
    );
  // Restart a fresh worker with cached weights and no network, not just RAM reuse.
  await context.setOffline(true);
  const cached = await page.evaluate(
    async ({ workerFile, photo }) => {
      const worker = new Worker(
        new URL("assets/" + workerFile, document.baseURI),
        { type: "module" },
      );
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Offline prepare timed out")),
          120000,
        );
        worker.onerror = (e) => {
          clearTimeout(timer);
          reject(Error(e.message));
        };
        worker.onmessage = (e) => {
          if (e.data.type === "result") {
            clearTimeout(timer);
            resolve(e.data.result);
            worker.terminate();
          }
        };
        worker.postMessage({ photo });
      });
    },
    { workerFile, photo: goatPhoto },
  );
  console.log("offline restart", JSON.stringify(cached));
  if (
    cached.status !== "candidates" ||
    cached.candidates[0]?.groupId !== "goat"
  )
    throw Error("Cached model unavailable offline");
} finally {
  await browser.close();
}
