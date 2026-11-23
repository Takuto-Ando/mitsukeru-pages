import photoModel from "../../src/recognition/bioclip-model.json" with { type: "json" };
import { expect, test, type Page } from "./fixtures";

test.use({ serviceWorkers: "block" });

async function openTutorialLoader(page: Page) {
  await page.goto("./");
  for (const label of [
    "はじめから",
    "決定！",
    "こんにちは！",
    "やってみる！",
    "撮ってみる！",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }
}

test("チュートリアルでは実際の受信量を表示し、両方のモデルが保存されたら撮影へ進む", async ({
  page,
  browserName,
}) => {
  let releaseDetector!: () => void;
  let detectorRequests = 0;
  const detector = new Promise<void>((resolve) => (releaseDetector = resolve));
  await page.route("**/models/yolox*.onnx", async (route) => {
    detectorRequests++;
    await detector;
    await route.fulfill({ body: Buffer.alloc(3_659_407) });
  });
  await page.addInitScript(
    ({ photoUrl }) => {
      // The fixture streams a short placeholder. Stub the recognition worker
      // so its real size validation does not evict this test's cached input.
      window.Worker = new Proxy(window.Worker, {
        construct(target, args: [string | URL, WorkerOptions?]) {
          if (args[1]?.name !== "zooketch-species-recognition")
            return Reflect.construct(target, args);
          return {
            onmessage: undefined as
              ((event: { data: unknown }) => void) | undefined,
            terminate() {},
            postMessage({ photo }: { photo?: Blob }) {
              queueMicrotask(() =>
                this.onmessage?.({
                  data: {
                    type: "result",
                    result: photo ? { status: "unknown" } : { status: "ready" },
                  },
                }),
              );
            },
          };
        },
      });
      const fetchNetwork = window.fetch.bind(window);
      let sent = false;
      window.fetch = (input, init) =>
        String(input) !== photoUrl
          ? fetchNetwork(input, init)
          : Promise.resolve(
              new Response(
                new ReadableStream<Uint8Array>({
                  start(controller) {
                    window.addEventListener(
                      "test:download-chunk",
                      () => {
                        sent = true;
                        controller.enqueue(new Uint8Array(8 * 1024 * 1024));
                      },
                      { once: true },
                    );
                    window.addEventListener(
                      "test:finish-download",
                      () => {
                        if (sent) controller.close();
                      },
                      { once: true },
                    );
                    document.documentElement.dataset.testModelStream = "ready";
                  },
                }),
                { headers: { "Content-Type": "application/octet-stream" } },
              ),
            );
    },
    { photoUrl: photoModel.url },
  );

  await openTutorialLoader(page);
  const loader = page.getByRole("progressbar", {
    name: "画像認識モデルのダウンロード",
  });
  const camera = page.locator(".replica-camera");
  try {
    await expect(loader).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-model-stream",
      "ready",
    );
    await expect(camera).toHaveCount(0);
    await page.evaluate(() =>
      window.dispatchEvent(new Event("test:download-chunk")),
    );
    await expect(loader).toHaveAttribute("aria-valuenow", "9");
    await expect(camera).toHaveCount(0);

    await page.evaluate(() =>
      window.dispatchEvent(new Event("test:finish-download")),
    );
    await expect(loader).toHaveAttribute("aria-valuenow", "95");
    await expect(camera).toHaveCount(0);
  } finally {
    releaseDetector();
  }
  await expect(camera).toBeVisible();
  await expect(loader).toHaveCount(0);
  const cachedModels = await page.evaluate(
    async ({ name, url }) => {
      const detector = await caches.open(
        "zooketch-detection-yolox-nano-coco-0.1.1rc0",
      );
      const species = await caches.open(name);
      return {
        detector: (await detector.keys()).some(({ url }) =>
          url.endsWith(".onnx"),
        ),
        species: !!(await species.match(url)),
      };
    },
    { name: photoModel.cache, url: photoModel.url },
  );
  expect(cachedModels).toEqual({ detector: true, species: true });

  // The default Playwright WebKit context drops Cache Storage on navigation.
  // Both caches are checked above there; Chromium can also test reuse on reload.
  if (browserName === "chromium") {
    await openTutorialLoader(page);
    await expect(camera).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-test-model-stream",
      "ready",
    );
    expect(detectorRequests).toBe(1);
  }
});

test("モデルのダウンロードに失敗したら同じ画面から再試行できる", async ({
  page,
}) => {
  await page.route("**/models/yolox*.onnx", (route) =>
    route.fulfill({ body: Buffer.alloc(3_659_407) }),
  );
  let downloadAvailable = false;
  let attempts = 0;
  await page.route(photoModel.url, (route) => {
    attempts++;
    return route.fulfill({
      status: downloadAvailable ? 200 : 503,
      body: downloadAvailable ? "mock model asset" : "",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await openTutorialLoader(page);
  await expect(page.locator(".tutorial-model-download")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(
    "通信を確認して、もう一度試してね。",
  );
  await expect(page.locator(".replica-camera")).toHaveCount(0);
  downloadAvailable = true;
  await page.getByRole("button", { name: "もう一度試す" }).click();
  await expect(page.locator(".replica-camera")).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
});
