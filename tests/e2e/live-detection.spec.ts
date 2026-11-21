import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

test.use({ testLiveModel: true });

const testPhoto =
  "data:image/png;base64," +
  readFileSync("public/replica-assets/giraffe-example.png").toString("base64");

test("起動時に自動保存した実モデルでオフライン中もライブの枠と候補名を表示できる", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.E2E_PREVIEW !== "1",
    "オフライン再読み込みには本番ビルドが必要",
  );
  test.setTimeout(75_000);
  await page.addInitScript((photo) => {
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
  }, testPhoto);

  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await page.goto("./");
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined),
  );
  await button("設定").click();
  await page.getByText("動物認識の事前ダウンロード", { exact: true }).click();
  await expect(button("ライブ検出モデル保存済み")).toBeDisabled({
    timeout: 20_000,
  });
  await button("設定を閉じる").click();
  await context.setOffline(true);
  await page.reload();

  await button("はじめから").click();
  await button("スキップ").click();
  const detection = page
    .locator(".live-animal-box")
    .filter({ hasText: "キリンの候補" })
    .first();
  await expect(detection).toBeVisible({ timeout: 12000 });
  expect((await detection.boundingBox())?.height).toBeGreaterThan(20);
  await button("ライブ検出 ON").click();
  await expect(detection).toHaveCount(0);
  await button("ライブ検出 OFF").click();
  await expect(detection).toBeVisible();

  await button("シャッター").click();
  await expect(page.locator(".captured-preview")).toBeVisible();
  await expect(detection).toHaveCount(0);
});
