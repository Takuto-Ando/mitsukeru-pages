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
  await button(page, "はじめから").click();
  const camera = page.locator(".replica-camera");
  await expect(camera).toHaveAttribute("data-figma-node", "38-1026");
  const shutter = button(page, "シャッター");
  await expect(shutter).toBeInViewport();
  await expect(camera.getByRole("button", { name: /ライブ検出/ })).toHaveCount(
    0,
  );
  await expect(camera.locator(".replica-camera-alternatives")).toHaveCount(0);
  await expect(camera.locator(".design3-camera-guides")).toBeVisible({
    timeout: 15_000,
  });
  await expect(camera.locator(".design3-camera-guides")).toHaveAttribute(
    "src",
    /figma\/entry\/camera-guides\.svg$/,
  );
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
  await expect(page.getByText(/写真から動物の候補を探しています/)).toHaveCount(
    0,
  );
  expect(photoModelRequests).toBe(0);
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
            const giraffe = sessionStorage.getItem("test:animal-moved")
              ? { left: 0.26, top: 0.21, right: 0.71, bottom: 0.71 }
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
  const guide = camera.locator(".design3-camera-guides");
  await expect(guide).toBeVisible();
  await expect(camera).toHaveAttribute("data-figma-node", "43-1745");
  const before = (await guide.boundingBox())!;
  await page.evaluate(() => sessionStorage.setItem("test:animal-moved", "1"));
  await expect
    .poll(async () => (await guide.boundingBox())?.x)
    .toBeGreaterThan(before.x + 20);
  expect((await guide.boundingBox())?.y).toBeGreaterThan(before.y + 15);
  expect((await guide.boundingBox())?.width).toBeGreaterThan(before.width + 20);
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

test("チュートリアルではライブ認識だけを事前準備し、撮影画面で通信中を表示する", async ({
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
    await button(page, "はじめから").click();
    await expect.poll(() => requestArrived, { timeout: 15_000 }).toBe(true);
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
