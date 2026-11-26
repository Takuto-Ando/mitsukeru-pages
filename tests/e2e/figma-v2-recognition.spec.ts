import { readFileSync } from "node:fs";
import photoModel from "../../src/recognition/bioclip-model.json" with { type: "json" };
import { expect, mockTutorialModels, test, type Page } from "./fixtures";

test.skip(process.env.VITE_LEGACY_EDITIONS === "1", "Figma v2の本体専用");
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  // A controlling worker can bypass Playwright routes in WebKit.
  await context.addInitScript(() => {
    if (navigator.serviceWorker) {
      Object.defineProperty(navigator.serviceWorker, "register", {
        configurable: true,
        value: () => Promise.reject(new Error("Disabled for model routing")),
      });
    }
  });
});

const sample =
  "data:image/png;base64," +
  readFileSync("public/replica-assets/giraffe-example.png").toString("base64");

function button(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

async function useMockCamera(page: Page, waitForPermission = false) {
  await page.addInitScript(
    ({ photo, waitForPermission }) => {
      const image = new Image();
      image.src = photo;
      const track = { stop() {} };
      const permission = waitForPermission
        ? new Promise<void>((resolve) =>
            window.addEventListener("test:camera-permission", () => resolve(), {
              once: true,
            }),
          )
        : undefined;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            if (sessionStorage.getItem("test:camera-denied"))
              throw new DOMException("Permission denied", "NotAllowedError");
            await permission;
            await image.decode();
            return { getTracks: () => [track], getVideoTracks: () => [track] };
          },
        },
      });
      Object.defineProperties(HTMLVideoElement.prototype, {
        srcObject: { configurable: true, set() {}, get: () => null },
        videoWidth: { configurable: true, get: () => image.naturalWidth },
        videoHeight: { configurable: true, get: () => image.naturalHeight },
        play: { configurable: true, value: () => Promise.resolve() },
      });
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (
        ...args: Parameters<typeof draw>
      ) {
        if (args[0] instanceof HTMLVideoElement) args[0] = image;
        return draw.apply(this, args);
      };
    },
    { photo: sample, waitForPermission },
  );
}

test("カメラと撮影・写真の保存は失敗しても同じ画面から再試行できる", async ({
  page,
}) => {
  await useMockCamera(page);
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    sessionStorage.setItem("test:camera-denied", "1");
    let failCapture = true;
    const capture = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      if (failCapture && args[0] === "image/jpeg") {
        failCapture = false;
        throw new DOMException(
          "Capture temporarily failed",
          "InvalidStateError",
        );
      }
      return capture.apply(this, args);
    };
    let failSave = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (failSave && this.name === "gallery") {
        failSave = false;
        throw new DOMException("No storage space", "QuotaExceededError");
      }
      return put.apply(this, args);
    };
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  await expect(page.getByText(/カメラを開けませんでした/)).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem("test:camera-denied"));
  await button(page, "カメラをもう一度開く").click();
  await expect(page.getByText(/カメラを開けませんでした/)).toHaveCount(0);
  const shutter = button(page, "シャッター");
  await expect(shutter).toBeEnabled();
  await shutter.click();
  await expect(
    page.getByText("撮影できませんでした。もう一度試してね。"),
  ).toBeVisible();
  await shutter.click();
  await expect(page.getByRole("alert")).toHaveText(
    "写真を保存できませんでした。続けて描くことはできます。",
  );
  await button(page, "もう一度試す").click();
  await expect(
    page.getByRole("heading", { name: "写真をギャラリーに保存しました。" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("チュートリアルの見本写真からもカメラへの再試行で実写に復帰できる", async ({
  page,
}) => {
  await mockTutorialModels(page);
  await useMockCamera(page);
  await page.addInitScript(() =>
    sessionStorage.setItem("test:camera-denied", "1"),
  );
  await page.goto("./");
  for (const step of [
    "はじめから",
    "決定！",
    "こんにちは！",
    "やってみる！",
    "撮ってみる！",
  ])
    await button(page, step).click();
  const retry = button(page, "カメラをもう一度開く");
  await expect(retry).toBeVisible();
  await expect(page.locator("img.camera-pitsune-binoculars")).toHaveAttribute(
    "src",
    /\/replica-assets\/camera-binoculars\.svg$/,
  );
  await page.evaluate(() => sessionStorage.removeItem("test:camera-denied"));
  await retry.click();
  await expect(page.getByLabel("動物を映すカメラ")).toBeVisible();
  await button(page, "シャッター").click();
  await expect(
    page.getByRole("heading", { name: "写真をギャラリーに保存しました。" }),
  ).toBeVisible();
});

test("ライブ認識を再試行し、白い枠だけの候補は撮影後の動物名として確定しない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    localStorage.setItem("zooketch-live-detection-v1", "0");
  });
  await useMockCamera(page);
  let photoModelRequests = 0;
  await page.route(photoModel.url, (route) => {
    photoModelRequests++;
    return route.abort();
  });
  let requests = 0;
  await page.route("**/models/yolox*.onnx", async (route) => {
    if (++requests === 1) await route.abort();
    else await route.continue();
  });

  await page.goto("./");
  // A normal Pages session has no cross-origin isolation; real YOLOX still
  // starts and predicts in this Worker with one WASM thread.
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await button(page, "つづきから").click();
  const camera = page.locator(".replica-camera");
  await expect(camera).toHaveAttribute("data-figma-node", "38-1026");
  await expect(
    camera.locator("img.camera-pitsune-binoculars"),
  ).toHaveJSProperty("naturalWidth", 104);
  const shutter = button(page, "シャッター");
  await expect(shutter).toBeInViewport();
  await expect(camera.getByRole("button", { name: /ライブ検出/ })).toHaveCount(
    0,
  );
  await expect(camera.locator(".replica-camera-alternatives")).toHaveCount(0);
  const guide = camera.locator(".replica-camera-tracking");
  await expect(guide).toBeVisible({ timeout: 15_000 });
  await expect(guide.locator("svg")).toHaveCount(4);
  await expect(camera.locator(".pitsune-bubble")).toHaveText("キリンかも！");
  await expect(camera.locator(".live-animal-overlay")).toHaveCount(0);
  await expect(camera.getByText(/の候補/)).toHaveCount(0);
  await expect(camera).toHaveAttribute("data-figma-node", "43-1494");
  expect(requests).toBeGreaterThanOrEqual(2);

  const middle = shutter.locator(".shutter-center");
  const color = await middle.evaluate(
    (element) => getComputedStyle(element).fill,
  );
  const bounds = (await shutter.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await expect(middle).toHaveCSS("opacity", "0.5");
  await expect(middle).toHaveCSS("fill", color);
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await shutter.click();
  const review = page.locator(".design3-photo-review");
  await expect(review).toHaveAttribute("data-figma-node", "66-7655");
  await expect(button(page, "描いてもらう")).toBeDisabled();
  await expect(review.getByRole("status")).toHaveText(
    "画像認識を利用できませんでした。",
  );
  await expect(review.locator(".replica-photo-selection-prompt")).toBeVisible();
  expect(photoModelRequests).toBeGreaterThan(0);
});

test("クマの白枠を維持しながら、種識別の準備後にレッサーパンダと表示する", async ({
  page,
}) => {
  await useMockCamera(page);
  await page.route("**/models/yolox*.onnx", (route) =>
    route.fulfill({ body: Buffer.alloc(3_659_407) }),
  );
  let releaseDownload!: () => void;
  const download = new Promise<void>((resolve) => {
    releaseDownload = resolve;
  });
  await page.route(photoModel.url, async (route) => {
    if (route.request().url().endsWith(".onnx")) await download;
    await route.fulfill({
      body: "mock model asset",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "4g", saveData: false },
    });
    const match = Cache.prototype.match;
    Cache.prototype.match = async function (request, options) {
      const hit = await match.call(this, request, options);
      if (
        !hit &&
        String(request).endsWith("/bioclip-image-int8.onnx") &&
        document.querySelector(".replica-camera")
      ) {
        document.documentElement.dataset.testCameraCacheMiss = "true";
      }
      return hit;
    };
    let reviewImages = 0;
    let liveImages = 0;
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        if (args[1]?.name === "zooketch-live-detection") {
          return {
            onmessage: undefined as
              ((event: { data: unknown }) => void) | undefined,
            terminate() {},
            postMessage({ type }: { type: string }) {
              queueMicrotask(() =>
                this.onmessage?.({
                  data:
                    type === "prepare"
                      ? { type: "ready" }
                      : {
                          type: "boxes",
                          boxes: [
                            {
                              label: "クマ",
                              score: 0.9,
                              left: 0.2,
                              top: 0.2,
                              right: 0.8,
                              bottom: 0.8,
                            },
                          ],
                        },
                }),
              );
            },
          };
        }
        if (args[1]?.name !== "zooketch-species-recognition")
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          postMessage({ photo, fit }: { photo?: string; fit?: string }) {
            if (!photo) {
              const root = document.documentElement;
              root.dataset.testModelWarm = String(
                Number(root.dataset.testModelWarm ?? 0) + 1,
              );
              queueMicrotask(() =>
                this.onmessage?.({
                  data: { type: "result", result: { status: "ready" } },
                }),
              );
              return;
            }
            const isReview = !!document.querySelector(".design3-photo-review");
            if (isReview) {
              document.documentElement.dataset.testReviewImages = String(
                ++reviewImages,
              );
              if (reviewImages <= 2) {
                queueMicrotask(() =>
                  this.onmessage?.({
                    data: { type: "result", result: { status: "unknown" } },
                  }),
                );
                return;
              }
            }
            if (!isReview) {
              document.documentElement.dataset.testLiveImages = String(
                ++liveImages,
              );
              if (fit !== "contain") {
                queueMicrotask(() =>
                  this.onmessage?.({
                    data: { type: "result", result: { status: "unknown" } },
                  }),
                );
                return;
              }
            }
            queueMicrotask(() =>
              this.onmessage?.({
                data: {
                  type: "result",
                  result: {
                    status: "candidates",
                    candidates: [
                      {
                        groupId: "kyoto-a-fulgens",
                        speciesId: "kyoto-a-fulgens",
                        score: 0.66,
                      },
                    ],
                  },
                },
              }),
            );
          },
        };
      },
    });
  });
  try {
    const downloading = page.waitForRequest(photoModel.url);
    await page.goto("./");
    await downloading;
    await page.evaluate(() => {
      const connection = navigator as Navigator & {
        connection: { effectiveType: string };
      };
      connection.connection.effectiveType = "3g";
    });
    await button(page, "つづきから").click();
    await expect(
      page.getByRole("heading", { name: "Now Loading…" }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "画像認識モデルのダウンロード" }),
    ).toBeVisible();
    await expect(button(page, "シャッター")).toBeEnabled();
    await expect(page.locator(".replica-camera-tracking")).toBeVisible();
    await expect(page.locator(".pitsune-bubble")).not.toContainText(
      "クマがいるよ！",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-camera-cache-miss",
      "true",
    );
  } finally {
    releaseDownload();
  }
  await expect(page.locator(".pitsune-bubble")).toHaveText(
    "レッサーパンダがいるよ！",
  );
  await expect(page.locator(".replica-camera-tracking")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-live-images",
    "2",
  );
  await button(page, "シャッター").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-review-images",
    "3",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-model-warm",
    "1",
  );
  await expect(
    page.getByRole("heading", { name: "レッサーパンダ" }),
  ).toBeVisible();
});

test("白枠がなくても撮影中の有力候補を見せ、撮影時は名前を確定しない", async ({
  page,
}) => {
  await useMockCamera(page);
  await page.route("**/models/yolox*.onnx", (route) => route.abort());
  let modelRequests = 0;
  await page.route(photoModel.url, (route) => {
    modelRequests++;
    return route.fulfill({
      body: "mock model asset",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "3g", saveData: false },
    });
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        if (args[1]?.name !== "zooketch-species-recognition")
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          postMessage({ photo, fit }: { photo?: string; fit?: string }) {
            if (photo && document.querySelector(".design3-photo-review"))
              return;
            queueMicrotask(() =>
              this.onmessage?.({
                data: {
                  type: "result",
                  result: !photo
                    ? { status: "ready" }
                    : fit === "contain"
                      ? { status: "unknown" }
                      : {
                          status: "candidates",
                          candidates: [
                            {
                              groupId: "kyoto-g-eremita",
                              speciesId: "kyoto-g-eremita",
                              score: 0.64,
                            },
                          ],
                          recognition: { status: "uncertain" },
                        },
                },
              }),
            );
          },
        };
      },
    });
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  const prepare = page
    .getByRole("region", { name: "Now Loading…" })
    .getByRole("button", { name: "ダウンロード", exact: true });
  await expect(prepare).toBeVisible();
  expect(modelRequests).toBe(0);
  await prepare.click();
  await expect(page.locator(".pitsune-bubble")).toHaveText(
    "ホオアカトキかも！",
  );
  expect(modelRequests).toBe(1);
  await expect(page.locator(".replica-camera-tracking")).toHaveCount(0);
  await button(page, "シャッター").click();
  await expect(page.locator(".design3-photo-review")).toHaveAttribute(
    "data-figma-node",
    "66-7655",
  );
  await expect(button(page, "描いてもらう")).toBeDisabled();
  await expect(button(page, "描いてもらう")).toHaveCSS("opacity", "0.25");
});

test("タブを開き直してモデルを使えないときはNow Loadingから更新できる", async ({
  page,
  context,
}) => {
  await page.goto("./");
  const url = page.url();
  await page.evaluate(async ({ cache, url }) => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    await (await caches.open(cache)).put(url, new Response("stale"));
  }, photoModel);
  await page.close();

  const reopened = await context.newPage();
  await useMockCamera(reopened);
  await mockTutorialModels(reopened, { photo: false });
  await reopened.addInitScript(({ cache, url, cachePath }) => {
    const network = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== url) return network(input, init);
      const root = document.documentElement;
      root.dataset.modelDownloads = String(
        Number(root.dataset.modelDownloads ?? 0) + 1,
      );
      return root.dataset.modelDownloadAvailable
        ? new Response("working")
        : new Response(null, { status: 503 });
    };
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        const name = args[1]?.name;
        if (
          name !== "zooketch-live-detection" &&
          name !== "zooketch-species-recognition"
        )
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          async postMessage(message: { type?: string; photo?: string }) {
            if (name === "zooketch-live-detection") {
              queueMicrotask(() =>
                this.onmessage?.({
                  data:
                    message.type === "prepare"
                      ? { type: "ready" }
                      : { type: "boxes", boxes: [] },
                }),
              );
              return;
            }
            const modelCache = await caches.open(cache);
            const key = new URL(cachePath, location.origin).href;
            const current = await modelCache.match(key);
            const model = current ?? (await modelCache.match(url));
            const contents = await model?.text();
            // The real worker removes only files that fail its size check.
            if (contents === "stale")
              await modelCache.delete(current ? key : url);
            this.onmessage?.({
              data: {
                type: "result",
                result:
                  contents !== "working"
                    ? { status: "unavailable" }
                    : !message.photo
                      ? { status: "ready" }
                      : {
                          status: "candidates",
                          candidates: [{ groupId: "giraffe", score: 0.99 }],
                        },
              },
            });
          },
        };
      },
    });
  }, photoModel);
  await reopened.goto(url);
  await button(reopened, "つづきから").click();
  const loading = reopened.getByRole("region", { name: "Now Loading…" });
  const retry = loading.getByRole("button", { name: "もう一度試す" });
  await expect(retry).toBeVisible();
  await expect(button(reopened, "シャッター")).toBeEnabled();
  const failedDownloads = await reopened.evaluate(() => {
    const root = document.documentElement;
    root.dataset.modelDownloadAvailable = "1";
    return Number(root.dataset.modelDownloads ?? 0);
  });
  await retry.click();
  await expect(reopened.locator(".pitsune-bubble")).toHaveText(
    "キリンがいるよ！",
  );
  await expect(loading).toHaveCount(0);
  await expect(reopened.locator("html")).toHaveAttribute(
    "data-model-downloads",
    String(failedDownloads + 1),
  );
  await button(reopened, "シャッター").click();
  await expect(
    reopened.getByRole("heading", { name: "キリン", exact: true }),
  ).toBeVisible();
});

test("保存済みのモデルはワーカー起動に失敗しても再ダウンロードせず復旧する", async ({
  page,
}) => {
  await useMockCamera(page);
  await mockTutorialModels(page, { photo: false });
  let requests = 0;
  await page.route(photoModel.url, (route) => {
    requests++;
    return route.fulfill({
      body: "saved test model",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.addInitScript(() => {
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        const detector = args[1]?.name === "zooketch-live-detection";
        if (!detector && args[1]?.name !== "zooketch-species-recognition")
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          postMessage(request: { type?: string; photo?: string }) {
            const recovered = !!document.documentElement.dataset.retryWorker;
            const data = detector
              ? request.type === "prepare"
                ? { type: "ready" }
                : { type: "boxes", boxes: [] }
              : {
                  type: "result",
                  result: !recovered
                    ? { status: "unavailable" }
                    : request.photo
                      ? {
                          status: "candidates",
                          candidates: [{ groupId: "giraffe", score: 0.99 }],
                        }
                      : { status: "ready" },
                };
            queueMicrotask(() => this.onmessage?.({ data }));
          },
        };
      },
    });
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  const retry = page
    .getByRole("region", { name: "Now Loading…" })
    .getByRole("button", { name: "もう一度試す" });
  await expect(retry).toBeVisible();
  expect(requests).toBe(1);
  await page.evaluate(
    () => (document.documentElement.dataset.retryWorker = "1"),
  );
  await retry.click();
  await expect(page.locator(".pitsune-bubble")).toHaveText("キリンがいるよ！");
  expect(requests).toBe(1);
});

async function checkReviewCandidate(page: Page, photoReferenceOnly: boolean) {
  await useMockCamera(page);
  await page.route(photoModel.url, (route) =>
    route.fulfill({
      body: "mock model asset",
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.addInitScript((photoReferenceOnly) => {
    let released = false;
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        if (args[1]?.name !== "zooketch-species-recognition")
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          postMessage({ photo }: { photo?: string }) {
            if (!photo) {
              queueMicrotask(() =>
                this.onmessage?.({
                  data: { type: "result", result: { status: "ready" } },
                }),
              );
              return;
            }
            if (!document.querySelector(".design3-photo-review")) return;
            const reply = () => {
              released = true;
              this.onmessage?.({
                data: {
                  type: "result",
                  result: photoReferenceOnly
                    ? {
                        status: "unknown",
                        reason: "ambiguous",
                        referenceSuggestion: {
                          groupId: "kyoto-g-eremita",
                          similarity: 0.62,
                          clear: true,
                        },
                      }
                    : {
                        status: "candidates",
                        candidates: [
                          {
                            groupId: "kyoto-g-eremita",
                            speciesId: "kyoto-g-eremita",
                            score: 0.66,
                          },
                        ],
                      },
                },
              });
            };
            if (released) queueMicrotask(reply);
            else
              window.addEventListener("test:species-ready", reply, {
                once: true,
              });
            document.documentElement.dataset.testSpeciesPending = "true";
          },
        };
      },
    });
  }, photoReferenceOnly);
  await page.goto("./");
  await button(page, "つづきから").click();
  await expect(page.locator(".pitsune-bubble")).toHaveText(
    "動物を探しにいこう！",
  );
  await button(page, "シャッター").click();
  const review = page.locator(".design3-photo-review");
  await expect(
    review.getByRole("img", { name: "撮影した動物の写真" }),
  ).toBeVisible();
  await expect(button(page, "修正")).toBeEnabled();
  await expect(
    review.getByText(/写真から(?:動物の)?候補を探しています/),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-species-pending",
    "true",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("test:species-ready")),
  );
  const suggestion = review.getByRole("list", {
    name: "写真から見つけた候補",
  });
  await expect(suggestion).toHaveCount(0);
  await button(page, "修正").click();
  await expect(
    review
      .locator(".replica-photo-picker > :first-child")
      .getByRole("searchbox", { name: "動物の名前で探す" }),
  ).toBeVisible();
  await expect(
    review.locator(".replica-photo-picker").locator(":scope > :nth-child(2)"),
  ).toHaveAttribute("aria-label", "写真から見つけた候補");
  const suggestedBird = suggestion.getByRole("button", {
    name: "ホオアカトキ 候補",
  });
  await expect(suggestedBird.getByText("候補", { exact: true })).toBeVisible();
  await expect(button(page, "描いてもらう")).toBeDisabled();
  await expect(suggestedBird.locator(".photo-picker-candidate-tag")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect(
    review.getByRole("list", { name: "動物の一覧" }).getByRole("button", {
      name: "ホオアカトキ",
      exact: true,
    }),
  ).toHaveCount(0);
  await suggestedBird.click();
  await expect(
    review.getByRole("heading", { name: "ホオアカトキ" }),
  ).toBeVisible();
  await expect(button(page, "描いてもらう")).toBeEnabled();
  await button(page, "描いてもらう").click();
  await button(page, "スケッチの準備を確認してつぎへ").click();
  await expect(page.locator(".design3-challenge h1")).toHaveAccessibleName(
    /^ホオアカトキ/,
  );
}

test("撮影直後に確認画面を開き、図鑑の種候補から課題を選べる", ({ page }) =>
  checkReviewCandidate(page, false));

test("通常候補がないときは写真参照の候補を修正から選べる", ({ page }) =>
  checkReviewCandidate(page, true));

test("モデルの再取得にはNow Loadingを使い、シャッターと手動再試行が使える", async ({
  page,
}) => {
  await useMockCamera(page);
  await mockTutorialModels(page, { detector: false });
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        if (args[1]?.name !== "zooketch-species-recognition")
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          postMessage({ photo }: { photo?: string }) {
            queueMicrotask(() =>
              this.onmessage?.({
                data: {
                  type: "result",
                  result: { status: photo ? "unknown" : "ready" },
                },
              }),
            );
          },
        };
      },
    });
  });
  let downloads = 0;
  let allowDownload = false;
  await page.route("**/models/yolox*.onnx", (route) => {
    downloads++;
    return allowDownload ? route.continue() : route.abort();
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  await expect(button(page, "シャッター")).toBeEnabled();
  await expect(button(page, "ライブ検出を再準備")).toHaveCount(0);
  const retry = page
    .getByRole("region", { name: "Now Loading…" })
    .getByRole("button", { name: "もう一度試す" });
  await expect(retry).toBeVisible({ timeout: 12_000 });
  expect(downloads).toBeGreaterThanOrEqual(3);
  allowDownload = true;
  await retry.click();
  await expect(page.locator(".replica-camera-tracking")).toBeVisible({
    timeout: 15_000,
  });
  await expect(retry).toHaveCount(0);
});

test("前の版で修了した端末も新しいチュートリアルで撮影でき、白い枠が動物を追う", async ({
  page,
}) => {
  await mockTutorialModels(page, { detector: false });
  await useMockCamera(page, true);
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v1", "1");
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        if (args[1]?.name !== "zooketch-live-detection")
          return Reflect.construct(target, args);
        return {
          onmessage: undefined,
          terminate() {},
          postMessage(message: { type: string }) {
            const distance = sessionStorage.getItem("test:animal-moved");
            const giraffe =
              distance === "far"
                ? { left: 0.36, top: 0.27, right: 0.54, bottom: 0.45 }
                : distance
                  ? { left: 0.26, top: 0.21, right: 0.71, bottom: 0.52 }
                  : { left: 0.12, top: 0.14, right: 0.47, bottom: 0.56 };
            const boxes = [{ label: "キリン", score: 0.8, ...giraffe }];
            if (sessionStorage.getItem("test:animal-moved")) {
              boxes.unshift({
                label: "ゾウ",
                score: 0.9,
                left: 0.03,
                top: 0.07,
                right: 0.19,
                bottom: 0.39,
              });
            }
            const worker = this as {
              onmessage?: (event: { data: object }) => void;
            };
            queueMicrotask(() =>
              worker.onmessage?.({
                data:
                  message.type === "prepare"
                    ? { type: "ready" }
                    : { type: "boxes", boxes },
              }),
            );
          },
        };
      },
    });
  });
  await page.route("**/models/yolox*.onnx", (route) =>
    route.fulfill({ body: Buffer.alloc(3_659_407) }),
  );
  await page.goto("./");
  await button(page, "はじめから").click();
  await button(page, "決定！").click();
  await button(page, "こんにちは！").click();
  await button(page, "やってみる！").click();
  await button(page, "撮ってみる！").click();
  const camera = page.locator(".replica-camera");
  const shutter = button(page, "シャッター");
  await expect(camera.locator(".camera-frame video")).toBeVisible();
  await expect(camera.locator(".pitsune-bubble")).toHaveText(
    "動物を探しにいこう！",
  );
  await expect(camera.locator(".camera-fallback")).toHaveCount(0);
  await expect(camera.getByText(/カメラを(?:起動|準備)しています/)).toHaveCount(
    0,
  );
  await expect(shutter).toBeDisabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("test:camera-permission")),
  );
  const guide = camera.locator(".replica-camera-tracking");
  await expect(guide).toBeVisible();
  await expect(camera).toHaveAttribute("data-figma-node", "43-1745");
  const corners = guide.locator("svg");
  const cornerGeometry = () =>
    corners.evaluateAll((elements) =>
      elements.map((corner) => {
        const rect = corner.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          viewBox: corner.getAttribute("viewBox"),
          stroke: getComputedStyle(corner.querySelector("path")!).strokeWidth,
          vectorEffect: corner
            .querySelector("path")
            ?.getAttribute("vector-effect"),
        };
      }),
    );
  const beforeCorners = await cornerGeometry();
  expect(beforeCorners).toHaveLength(4);
  for (const corner of beforeCorners) {
    expect(corner.width).toBeGreaterThan(0);
    expect(corner.width).toBe(corner.height);
    expect(parseFloat(corner.stroke)).toBeCloseTo(6.8);
    expect(corner.vectorEffect).toBe("non-scaling-stroke");
  }
  const cornerSpacing = async () => {
    const [topLeft, topRight, bottomLeft] = await Promise.all(
      [0, 1, 2].map((index) => corners.nth(index).boundingBox()),
    );
    return {
      horizontal: topRight!.x - (topLeft!.x + topLeft!.width),
      vertical: bottomLeft!.y - (topLeft!.y + topLeft!.height),
    };
  };
  const beforeSpacing = await cornerSpacing();
  const before = (await guide.boundingBox())!;
  await page.evaluate(() => sessionStorage.setItem("test:animal-moved", "1"));
  await expect
    .poll(async () => (await guide.boundingBox())?.x)
    .toBeGreaterThan(before.x + 20);
  expect((await guide.boundingBox())?.y).toBeGreaterThan(before.y + 15);
  const after = (await guide.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 20);
  expect(after.height).toBeLessThan(before.height - 20);
  expect(before.width).toBeLessThan(before.height);
  expect(after.width).toBeGreaterThan(after.height);
  expect(await cornerGeometry()).toEqual(beforeCorners);
  const afterSpacing = await cornerSpacing();
  expect(afterSpacing.horizontal).toBeGreaterThan(beforeSpacing.horizontal);
  expect(afterSpacing.vertical).toBeLessThan(beforeSpacing.vertical);

  await page.evaluate(() => sessionStorage.setItem("test:animal-moved", "far"));
  await expect
    .poll(async () => (await guide.boundingBox())?.width)
    .toBeLessThan(before.width * 0.65);
  const farCorners = await cornerGeometry();
  expect(farCorners).toHaveLength(4);
  for (const [index, corner] of farCorners.entries()) {
    expect(corner.width).toBeLessThan(beforeCorners[index].width);
    expect(corner.width).toBe(corner.height);
    expect(corner.viewBox).toBe(beforeCorners[index].viewBox);
    expect(corner.stroke).toBe(beforeCorners[index].stroke);
    expect(corner.vectorEffect).toBe("non-scaling-stroke");
  }
  const farSpacing = await cornerSpacing();
  expect(farSpacing.horizontal).toBeGreaterThanOrEqual(5);
  expect(farSpacing.vertical).toBeGreaterThanOrEqual(5);
  await expect(camera.locator(".pitsune-bubble")).toHaveText("キリンかも！");
  await expect(camera.locator(".live-animal-overlay")).toHaveCount(0);
  await expect(
    camera.getByRole("button", { name: "ギャラリー" }),
  ).toBeDisabled();
  await shutter.click();
  await expect(page.locator(".design3-photo-review")).toHaveAttribute(
    "data-figma-node",
    "52-5265",
  );
  await button(page, "修正").click();
  await button(page, "キリン").click();
  await expect(page.locator(".design3-photo-review")).toHaveAttribute(
    "data-figma-node",
    "43-1815",
  );
  await expect(
    page.getByRole("heading", { name: "キリン", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".captured-preview")).toBeVisible();
  await expect(button(page, "描いてもらう")).toBeEnabled();
});

test("タイトルからライブ認識を事前準備し、撮影画面でも通信中を表示する", async ({
  page,
}) => {
  await useMockCamera(page);
  let requestArrived = false;
  let releaseRequest!: () => void;
  const hold = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/models/yolox*.onnx", async (route) => {
    requestArrived = true;
    await hold;
    await route.abort();
  });
  try {
    await page.goto("./");
    await expect.poll(() => requestArrived, { timeout: 15_000 }).toBe(true);
    await button(page, "つづきから").click();
    const loading = page.getByRole("region", { name: "Now Loading…" });
    await expect(
      loading.getByText("画像識別モデルをダウンロード中…"),
    ).toBeVisible();
    await expect(loading.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await expect(button(page, "シャッター")).toBeEnabled();
  } finally {
    releaseRequest();
  }
});

test("低負荷端末では検出間隔を広げ、ズームでWorkerを作り直さず、裏画面では停止する", async ({
  page,
}) => {
  await useMockCamera(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 2 });
    let hidden = false;
    let elapsed = 0;
    Object.defineProperty(document, "hidden", { get: () => hidden });
    const actualNow = performance.now.bind(performance);
    Object.defineProperty(performance, "now", {
      value: () => actualNow() + elapsed,
    });
    const report = { starts: 0, stops: 0, frames: [] as number[] };
    Object.assign(window, { testLiveReport: report });
    window.addEventListener("test:hidden", () => {
      hidden = !hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    window.addEventListener("test:idle", () => {
      elapsed += 30_000;
    });
    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        if (args[1]?.name !== "zooketch-live-detection")
          return Reflect.construct(target, args);
        report.starts++;
        return {
          onmessage: undefined,
          terminate() {
            report.stops++;
          },
          postMessage(message: { type: string }) {
            if (message.type === "frame") report.frames.push(actualNow());
            const worker = this as {
              onmessage?: (event: { data: object }) => void;
            };
            queueMicrotask(() =>
              worker.onmessage?.({
                data:
                  message.type === "prepare"
                    ? { type: "ready" }
                    : { type: "boxes", boxes: [] },
              }),
            );
          },
        };
      },
    });
  });
  await page.route("**/models/yolox*.onnx", (route) =>
    route.fulfill({ body: Buffer.alloc(3_659_407) }),
  );
  const report = () =>
    page.evaluate(
      () =>
        (
          window as Window & {
            testLiveReport?: {
              starts: number;
              stops: number;
              frames: number[];
            };
          }
        ).testLiveReport!,
    );
  const emit = (name: string) =>
    page.evaluate((type) => window.dispatchEvent(new Event(type)), name);

  await page.goto("./");
  const mascot = page.locator(".design3-title-tail");
  await expect(mascot).toHaveCSS("animation-play-state", "running");
  await emit("test:hidden");
  await expect(mascot).toHaveCSS("animation-play-state", "paused");
  await emit("test:hidden");
  await expect(mascot).toHaveCSS("animation-play-state", "running");

  await button(page, "つづきから").click();
  await expect
    .poll(async () => (await report()).frames.length)
    .toBeGreaterThanOrEqual(2);
  const active = await report();
  expect(active.frames[1] - active.frames[0]).toBeGreaterThanOrEqual(680);
  await button(page, "2×").click();
  await expect
    .poll(async () => (await report()).frames.length)
    .toBeGreaterThan(active.frames.length);
  expect((await report()).starts).toBe(1);

  await emit("test:idle");
  const framesAtIdle = (await report()).frames.length;
  await expect
    .poll(async () => (await report()).frames.length, { timeout: 6000 })
    .toBeGreaterThan(framesAtIdle + 1);
  const idle = (await report()).frames;
  expect(idle.at(-1)! - idle.at(-2)!).toBeGreaterThanOrEqual(1450);

  await emit("test:hidden");
  await expect.poll(async () => (await report()).stops).toBe(1);
  const framesWhenHidden = (await report()).frames.length;
  await page.waitForTimeout(850);
  expect((await report()).frames.length).toBe(framesWhenHidden);
  await emit("test:hidden");
  await expect.poll(async () => (await report()).starts).toBe(2);
  await expect
    .poll(async () => (await report()).frames.length)
    .toBeGreaterThan(framesWhenHidden);
});

test("最初の切り出しで誤認識しても、次の読み取りを確認してから名前を更新する", async ({
  page,
}) => {
  await verifySpeciesSwitch(page, false);
});

test("別の動物へ白枠が切り替わったら古い候補を外し、新しい枠内の名前を再推論する", async ({
  page,
}) => {
  await verifySpeciesSwitch(page, true);
});

async function verifySpeciesSwitch(page: Page, moveBox: boolean) {
  await useMockCamera(page);
  await page.route("**/models/yolox*.onnx", (route) =>
    route.fulfill({ body: Buffer.alloc(3_659_407) }),
  );
  let releaseDownload!: () => void;
  const pending = new Promise<void>((resolve) => (releaseDownload = resolve));
  await page.route(photoModel.url, async (route) => {
    await pending;
    await route.fulfill({
      body: "mock model asset",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.addInitScript(
    ({ moveBox }) => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { effectiveType: "4g", saveData: false },
      });
      let switched = false;
      let newReadings = 0;
      let priorReadings = 0;
      let finishPrior: (() => void) | undefined;
      let finishConfirmation: (() => void) | undefined;
      window.addEventListener("test:change-species", () => (switched = true));
      window.addEventListener("test:finish-prior", () => finishPrior?.());
      window.addEventListener("test:confirm-species", () =>
        finishConfirmation?.(),
      );

      window.Worker = new Proxy(window.Worker, {
        construct(target, args: [string | URL, WorkerOptions?]) {
          const kind = args[1]?.name;
          if (
            kind !== "zooketch-species-recognition" &&
            kind !== "zooketch-live-detection"
          )
            return Reflect.construct(target, args);
          return {
            onmessage: undefined as
              ((event: { data: unknown }) => void) | undefined,
            terminate() {},
            postMessage({ type, photo }: { type?: string; photo?: Blob }) {
              const root = document.documentElement;
              const reply = (data: unknown) =>
                queueMicrotask(() => this.onmessage?.({ data }));
              if (kind === "zooketch-live-detection") {
                if (type === "prepare") {
                  reply({ type: "ready" });
                } else {
                  root.dataset.testSwitchBox = "ready";
                  reply({
                    type: "boxes",
                    boxes: [
                      {
                        label: "クマ",
                        score: 0.9,
                        left: moveBox ? (switched ? 0.57 : 0.15) : 0.22,
                        top: 0.22,
                        right: moveBox ? (switched ? 0.94 : 0.54) : 0.76,
                        bottom: 0.76,
                      },
                    ],
                  });
                }
                return;
              }
              if (!photo) {
                reply({ type: "result", result: { status: "ready" } });
                return;
              }
              const weak = moveBox && switched;
              const reading = switched ? ++newReadings : ++priorReadings;
              const id = switched
                ? !moveBox && reading === 1
                  ? "kyoto-g-eremita"
                  : "kyoto-a-fulgens"
                : "fennec";
              const finish = () => {
                const result =
                  weak && reading !== 1 && reading !== 3
                    ? { status: "unknown" }
                    : {
                        status: "candidates",
                        candidates: [
                          {
                            groupId: id,
                            speciesId: id,
                            score: weak ? 0.57 : 0.91,
                          },
                        ],
                        recognition: {
                          status: weak ? "uncertain" : "identified",
                        },
                      };
                reply({ type: "result", result });
              };
              if (moveBox && !switched && reading === 3) {
                root.dataset.testPriorReading = "pending";
                finishPrior = finish;
                return;
              }
              if (switched && reading === 2) {
                root.dataset.testSwitchConfirmation = "pending";
                finishConfirmation = finish;
                return;
              }
              finish();
            },
          };
        },
      });
    },
    { moveBox },
  );

  await page.goto("./");
  await button(page, "つづきから").click();
  try {
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-switch-box",
      "ready",
    );
  } finally {
    releaseDownload();
  }
  const bubble = page.locator(".pitsune-bubble");
  const emit = (name: string) =>
    page.evaluate((type) => window.dispatchEvent(new Event(type)), name);
  if (moveBox) {
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-prior-reading",
      "pending",
    );
    await expect(bubble).toHaveText("フェネックがいるよ！");
    const guide = page.locator(".replica-camera-tracking");
    const before = (await guide.boundingBox())!;
    await emit("test:change-species");
    await expect
      .poll(async () => (await guide.boundingBox())?.x)
      .toBeGreaterThan(before.x + 20);
    await expect(bubble).toHaveText("動物の名前を調べているよ！");
    await emit("test:finish-prior");
  } else {
    await expect(bubble).toHaveText("フェネックがいるよ！");
    await emit("test:change-species");
  }
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-switch-confirmation",
    "pending",
  );
  await expect(bubble).toHaveText(
    moveBox ? "動物の名前を調べているよ！" : "フェネックがいるよ！",
  );
  await emit("test:confirm-species");
  await expect(bubble).toHaveText("レッサーパンダがいるよ！");
}

test("白枠が揺れ続けても種識別が終わり、一度だけ検出が途切れても名前を保つ", async ({
  page,
}) => {
  const { guide, root, bubble, emit, settleReading } =
    await startControlledRecognition(page);
  await guide.evaluate((element) =>
    element.setAttribute("data-test-original-track", "true"),
  );
  // Move the same overlapping box before each pending inference reply.
  // A geometry-only invalidation would discard both and keep the prompt.
  for (const [reading, left] of [
    [1, 36],
    [2, 22],
  ] as const) {
    await expect(root).toHaveAttribute(
      "data-test-jitter-readings",
      String(reading),
    );
    await emit("test:jitter-box");
    await expect(guide).toHaveAttribute(
      "style",
      new RegExp(`--tracking-left: ${left}%`),
    );
    await expect(guide).toHaveAttribute("data-test-original-track", "true");
    await settleReading("kyoto-a-fulgens");
  }
  await expect(bubble).toHaveText("レッサーパンダがいるよ！");

  await emit("test:jitter-box");
  await expect(guide).toHaveAttribute("style", /--tracking-left: 36%/);
  await expect(bubble).toHaveText("レッサーパンダがいるよ！");
  await emit("test:skip-detection");
  await expect(root).toHaveAttribute("data-test-jitter-miss", "settled");
  await expect(guide).toHaveAttribute("data-test-original-track", "true");
  await expect(bubble).toHaveText("レッサーパンダがいるよ！");
  await expect(button(page, "シャッター")).toBeEnabled();
});

test("白枠があって候補が割れたときは、判定中と撮影で確認できる状態を区別する", async ({
  page,
}) => {
  const { root, bubble, settleReading } =
    await startControlledRecognition(page);
  await expect(root).toHaveAttribute("data-test-jitter-readings", "1");
  await expect(bubble).toHaveText("動物の名前を調べているよ！");
  for (const [index, species] of [
    "kyoto-a-fulgens",
    "fennec",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ].entries()) {
    await expect(root).toHaveAttribute(
      "data-test-jitter-readings",
      String(index + 1),
    );
    await settleReading(species);
  }
  await expect(bubble).toHaveText("写真を撮って確かめよう！");
  await expect(button(page, "シャッター")).toBeEnabled();
});

test("種識別の応答が途切れたら、白枠とシャッターを使ったまま推論をやり直す", async ({
  page,
}) => {
  await page.clock.install();
  const { root, bubble, guide, settleReading } =
    await startControlledRecognition(page);
  await expect(root).toHaveAttribute("data-test-jitter-readings", "1");
  await page.clock.fastForward(15_100);
  await expect(button(page, "シャッター")).toBeEnabled();
  await expect(guide).toBeVisible();
  await page.clock.fastForward(1_600);
  for (const reading of [2, 3]) {
    await expect(root).toHaveAttribute(
      "data-test-jitter-readings",
      String(reading),
    );
    await settleReading("kyoto-a-fulgens");
  }
  await expect(bubble).toHaveText("レッサーパンダがいるよ！");
});

async function startControlledRecognition(page: Page) {
  await useMockCamera(page);
  await page.route("**/models/yolox*.onnx", (route) =>
    route.fulfill({ body: Buffer.alloc(3_659_407) }),
  );
  let releaseDownload!: () => void;
  const pending = new Promise<void>((resolve) => (releaseDownload = resolve));
  await page.route(photoModel.url, async (route) => {
    await pending;
    await route.fulfill({
      body: "mock model asset",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "4g", saveData: false },
    });
    let shifted = false;
    let skipDetection = false;
    let detectionPaused = false;
    let readings = 0;
    let finishReading: ((species?: string) => void) | undefined;
    window.addEventListener("test:jitter-box", () => (shifted = !shifted));
    window.addEventListener(
      "test:skip-detection",
      () => (skipDetection = true),
    );
    window.addEventListener("test:settle-reading", (event) =>
      finishReading?.((event as CustomEvent<string | undefined>).detail),
    );

    window.Worker = new Proxy(window.Worker, {
      construct(target, args: [string | URL, WorkerOptions?]) {
        const kind = args[1]?.name;
        if (
          kind !== "zooketch-species-recognition" &&
          kind !== "zooketch-live-detection"
        )
          return Reflect.construct(target, args);
        return {
          onmessage: undefined as
            ((event: { data: unknown }) => void) | undefined,
          terminate() {},
          postMessage({ type, photo }: { type?: string; photo?: Blob }) {
            const root = document.documentElement;
            const reply = (data: unknown) =>
              queueMicrotask(() => this.onmessage?.({ data }));
            if (kind === "zooketch-live-detection") {
              if (type === "prepare") {
                reply({ type: "ready" });
              } else if (skipDetection) {
                skipDetection = false;
                detectionPaused = true;
                reply({ type: "boxes", boxes: [] });
              } else if (detectionPaused) {
                root.dataset.testJitterMiss = "settled";
              } else {
                reply({
                  type: "boxes",
                  boxes: [
                    {
                      label: "クマ",
                      score: 0.9,
                      left: shifted ? 0.36 : 0.22,
                      top: 0.22,
                      right: shifted ? 0.9 : 0.76,
                      bottom: 0.76,
                    },
                  ],
                });
              }
              return;
            }
            if (!photo) {
              reply({ type: "result", result: { status: "ready" } });
              return;
            }
            root.dataset.testJitterReadings = String(++readings);
            finishReading = (species) =>
              reply({
                type: "result",
                result: species
                  ? {
                      status: "candidates",
                      candidates: [
                        { groupId: species, speciesId: species, score: 0.91 },
                      ],
                      recognition: { status: "identified" },
                    }
                  : { status: "unknown" },
              });
          },
        };
      },
    });
  });

  await page.goto("./");
  await button(page, "つづきから").click();
  const guide = page.locator(".replica-camera-tracking");
  try {
    await expect(guide).toBeVisible();
  } finally {
    releaseDownload();
  }
  return {
    guide,
    root: page.locator("html"),
    bubble: page.locator(".pitsune-bubble"),
    emit: (name: string) =>
      page.evaluate((type) => window.dispatchEvent(new Event(type)), name),
    settleReading: (species?: string) =>
      page.evaluate(
        (detail) =>
          window.dispatchEvent(
            new CustomEvent("test:settle-reading", { detail }),
          ),
        species,
      ),
  };
}

for (const recover of [true, false]) {
  test(`写真の推論ワーカーが停止したら再作成し、${recover ? "同じ写真の候補を表示する" : "手動選択できる案内を出す"}`, async ({
    page,
  }) => {
    await useMockCamera(page);
    await mockTutorialModels(page, { detector: false });
    await page.addInitScript((recover) => {
      let photoRequests = 0;
      let failedWorker: object | undefined;
      window.Worker = new Proxy(window.Worker, {
        construct(target, args: [string | URL, WorkerOptions?]) {
          if (args[1]?.name !== "zooketch-species-recognition")
            return Reflect.construct(target, args);
          return {
            onmessage: undefined as
              ((event: { data: unknown }) => void) | undefined,
            terminate() {},
            postMessage({ photo }: { photo?: Blob }) {
              let result: unknown = { status: "ready" };
              if (photo) {
                if (document.querySelector(".design3-photo-review")) {
                  document.documentElement.dataset.photoRequests = String(
                    ++photoRequests,
                  );
                  failedWorker ??= this;
                  result =
                    !recover || failedWorker === this
                      ? { status: "unavailable", reason: "ONNX failed" }
                      : {
                          status: "candidates",
                          candidates: [{ groupId: "giraffe", score: 0.99 }],
                        };
                } else result = { status: "unknown" };
              }
              queueMicrotask(() =>
                this.onmessage?.({ data: { type: "result", result } }),
              );
            },
          };
        },
      });
    }, recover);
    await page.goto("./");
    await button(page, "つづきから").click();
    await button(page, "シャッター").click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-photo-requests",
      "2",
    );
    await button(page, "修正").click();
    if (recover) {
      await expect(
        page.getByRole("list", { name: "写真から見つけた候補" }),
      ).toContainText("キリン");
    } else {
      await expect(page.getByRole("status")).toHaveText(
        "画像認識を利用できませんでした。",
      );
      await expect(
        page.getByRole("list", { name: "動物の一覧" }),
      ).toBeVisible();
    }
  });
}
