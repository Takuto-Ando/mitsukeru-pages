import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

test.skip(process.env.VITE_LEGACY_EDITIONS === "1", "Figma v2の本体専用");
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  // A controlling worker can bypass Playwright routes in WebKit.
  await page.addInitScript(() => {
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
    page.getByRole("heading", { name: "写真をアルバムに保存しました。" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("チュートリアルの見本写真からもカメラへの再試行で実写に復帰できる", async ({
  page,
}) => {
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
  await page.evaluate(() => sessionStorage.removeItem("test:camera-denied"));
  await retry.click();
  await expect(page.getByLabel("動物を映すカメラ")).toBeVisible();
  await button(page, "シャッター").click();
  await expect(
    page.getByRole("heading", { name: "写真をアルバムに保存しました。" }),
  ).toBeVisible();
});

test("ライブ認識を再試行し、白い枠とセリフを表示して撮影時の動物名を引き継ぐ", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    localStorage.setItem("zooketch-live-detection-v1", "0");
  });
  await useMockCamera(page);
  let photoModelRequests = 0;
  await page.route(
    "https://huggingface.co/Xenova/clip-vit-base-patch32/**",
    (route) => {
      photoModelRequests++;
      return route.abort();
    },
  );
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
  const shutter = button(page, "シャッター");
  await expect(shutter).toBeInViewport();
  await expect(camera.getByRole("button", { name: /ライブ検出/ })).toHaveCount(
    0,
  );
  await expect(camera.locator(".replica-camera-alternatives")).toHaveCount(0);
  const guide = camera.locator(".replica-camera-tracking");
  await expect(guide).toBeVisible({ timeout: 15_000 });
  await expect(guide.locator("svg")).toHaveCount(4);
  await expect(camera.locator(".pitsune-bubble")).toHaveText(
    "キリンがいるよ！",
  );
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
  await expect(review).toHaveAttribute("data-figma-node", "66-7554");
  await expect(
    review.getByRole("heading", { name: "キリン", exact: true }),
  ).toBeVisible();
  await expect(button(page, "ピツネに見せる")).toBeEnabled();
  await expect(review.getByRole("status")).toContainText(
    "動物の名前を選んでください",
  );
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
  await page.route(
    "https://huggingface.co/Xenova/clip-vit-base-patch32/**",
    async (route) => {
      if (route.request().url().endsWith(".onnx")) await download;
      await route.fulfill({
        body: "mock model asset",
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    },
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "3g", saveData: false },
    });
    const match = Cache.prototype.match;
    Cache.prototype.match = async function (request, options) {
      const hit = await match.call(this, request, options);
      if (
        !hit &&
        String(request).endsWith("/model_quantized.onnx") &&
        document.querySelector(".replica-camera")
      ) {
        document.documentElement.dataset.testCameraCacheMiss = "true";
      }
      return hit;
    };
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
          terminate() {
            document.documentElement.dataset.testStoppedSpecies = "true";
          },
          postMessage({ photo }: { photo?: string }) {
            if (!photo) {
              document.documentElement.dataset.testModelWarm = "true";
              queueMicrotask(() =>
                this.onmessage?.({
                  data: { type: "result", result: { status: "ready" } },
                }),
              );
              return;
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
    const downloading = page.waitForRequest(
      "https://huggingface.co/**/model_quantized.onnx",
    );
    await page.goto("./");
    await downloading;
    await button(page, "つづきから").click();
    await expect(page.locator(".replica-camera-model-status")).toHaveText(
      "画像認識モデルをダウンロード中…",
    );
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
  await button(page, "シャッター").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-stopped-species",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "レッサーパンダ" }),
  ).toBeVisible();
});

test("撮影直後に確認画面を開き、図鑑の種候補から課題を選べる", async ({
  page,
}) => {
  await useMockCamera(page);
  await page.route(
    "https://huggingface.co/Xenova/clip-vit-base-patch32/**",
    (route) =>
      route.fulfill({
        body: "mock model asset",
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
  );
  await page.addInitScript(() => {
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
            window.addEventListener(
              "test:species-ready",
              () => {
                this.onmessage?.({
                  data: {
                    type: "result",
                    result: {
                      status: "candidates",
                      candidates: [
                        {
                          groupId: "kyoto-s-humboldti",
                          speciesId: "kyoto-s-humboldti",
                          score: 0.66,
                        },
                      ],
                    },
                  },
                });
              },
              { once: true },
            );
            document.documentElement.dataset.testSpeciesPending = "true";
          },
        };
      },
    });
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  await button(page, "シャッター").click();
  const review = page.locator(".design3-photo-review");
  await expect(
    review.getByRole("img", { name: "撮影した動物の写真" }),
  ).toBeVisible();
  await expect(button(page, "修正")).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-species-pending",
    "true",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("test:species-ready")),
  );
  const suggestion = review.getByRole("group", {
    name: "写真から見つけた候補",
  });
  await suggestion.getByRole("button", { name: "フンボルトペンギン" }).click();
  await expect(
    review.getByRole("heading", { name: "フンボルトペンギン" }),
  ).toBeVisible();
  await expect(button(page, "ピツネに見せる")).toBeEnabled();
  await button(page, "ピツネに見せる").click();
  await button(page, "スケッチの準備を確認してつぎへ").click();
  await expect(page.locator(".design3-challenge h1")).toHaveAccessibleName(
    /^フンボルトペンギン/,
  );
});

test("ライブ認識の自動再試行が尽きてもシャッターと手動再試行が使える", async ({
  page,
}) => {
  await useMockCamera(page);
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
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
  const retry = button(page, "ライブ検出を再準備");
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
  await expect(camera.locator(".pitsune-bubble")).toHaveText(
    "キリンがいるよ！",
  );
  await expect(camera.locator(".live-animal-overlay")).toHaveCount(0);
  await expect(
    camera.getByRole("button", { name: "ギャラリー" }),
  ).toBeDisabled();
  await shutter.click();
  await expect(page.locator(".design3-photo-review")).toHaveAttribute(
    "data-figma-node",
    "43-1815",
  );
  await expect(
    page.getByRole("heading", { name: "キリン", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".captured-preview")).toBeVisible();
  await expect(button(page, "ピツネに見せる")).toBeEnabled();
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
    await button(page, "はじめから").click();
    await button(page, "決定！").click();
    await button(page, "こんにちは！").click();
    await button(page, "やってみる！").click();
    await button(page, "撮ってみる！").click();
    await expect(
      page.locator(".camera-frame .replica-camera-model-status"),
    ).toHaveText("画像認識モデルをダウンロード中…");
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
