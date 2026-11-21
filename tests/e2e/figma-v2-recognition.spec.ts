import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

test.skip(process.env.VITE_LEGACY_EDITIONS === "1", "Figma v2の本体専用");

const sample =
  "data:image/png;base64," +
  readFileSync("public/replica-assets/giraffe-example.png").toString("base64");

function button(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

test("撮影画面でライブ検出を自動で準備し、通信失敗から再試行できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript((photo) => {
    localStorage.setItem("zooketch-replica-tutorial-v1", "1");
    const image = new Image();
    image.src = photo;
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
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
  }, sample);
  let requests = 0;
  let fail = true;
  await page.route("**/models/yolox*.onnx", async (route) => {
    requests++;
    if (fail) await route.abort();
    else await route.continue();
  });

  await page.goto("./");
  await button(page, "はじめから").click();
  const retry = button(page, "ライブ検出を再準備");
  await expect(retry).toBeInViewport();
  await expect(button(page, "シャッター")).toBeInViewport();
  expect(requests).toBeGreaterThan(0);
  fail = false;
  await retry.click();
  const box = page
    .locator(".live-animal-box")
    .filter({ hasText: "キリンの候補" })
    .first();
  await expect(box).toBeVisible({ timeout: 15_000 });
  await button(page, "ライブ検出 ON").click();
  await expect(box).toHaveCount(0);
  await button(page, "ライブ検出 OFF").click();
  await expect(box).toBeVisible({ timeout: 15_000 });
});

test("チュートリアルで写真認識を事前に準備し、撮影画面で通信中を表示する", async ({
  page,
}) => {
  const model = "https://huggingface.co/Xenova/clip-vit-base-patch32/**";
  // Keep this scenario independent of the live model transfer and cache warmup.
  await page.route("**/models/*.onnx", (route) =>
    route.fulfill({ status: 503, body: "offline" }),
  );
  let requestArrived = false;
  let releaseRequest!: () => void;
  const hold = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route(model, async (route) => {
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
      page.getByText("画像認識モデルをダウンロード中…", { exact: true }),
    ).toBeVisible();
    await expect(button(page, "シャッター")).toBeEnabled();
  } finally {
    releaseRequest();
  }
});
