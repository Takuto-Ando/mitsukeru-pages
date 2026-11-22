import { expect, test, type Page } from "./fixtures";

test("起動モジュールの通信が切れても回復案内から起動し直せる", async ({
  page,
}) => {
  const entry =
    /\/(?:src\/replica-main\.tsx|assets\/replica-main-[\w-]+\.js)(?:\?|$)/;
  await page.route(entry, (route) => route.abort());
  await page.goto("./");
  await expect(page.getByRole("alert")).toHaveText("画面を開けませんでした。");
  await page.unroute(entry);
  await page.getByRole("button", { name: "もう一度試す" }).click();
  await expect(page.getByRole("button", { name: "はじめから" })).toBeVisible();
});

async function openCamera(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "つづきから" }).click();
}

test("タイトルで全画像を読み込まず、一時的なギャラリー読込失敗は再試行できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.getAll;
    let attempts = 0;
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.name === "gallery") {
        document.documentElement.dataset.testGalleryReads = String(++attempts);
        if (attempts === 1)
          throw new DOMException("Unavailable", "UnknownError");
      }
      return original.apply(this, args);
    };
  });
  await openCamera(page);
  const html = page.locator("html");
  expect(await html.getAttribute("data-test-gallery-reads")).toBeNull();
  await page.getByRole("button", { name: "ギャラリー", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "ギャラリーを開けませんでした。",
  );
  await page.getByRole("button", { name: "もう一度試す" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(html).toHaveAttribute("data-test-gallery-reads", "2");
});

test("描画画面の描画準備で例外が起きても起動し直せる", async ({ page }) => {
  await openCamera(page);
  const click = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  await click("シャッター");
  await click("修正");
  await click("キリン");
  await click("ピツネに見せる");
  await page.evaluate(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (query === "(min-width: 760px)")
        throw new Error("Drawing setup failed");
      return original(query);
    };
  });
  await click("スケッチの準備を確認してつぎへ");
  await click("課題を確認してつぎへ");
  await expect(page.getByRole("alert")).toHaveText("画面を開けませんでした。");
  await click("もう一度試す");
  await expect(page.getByRole("button", { name: "はじめから" })).toBeVisible();
});
