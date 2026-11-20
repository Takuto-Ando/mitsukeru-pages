import { expect, test, type Page } from "@playwright/test";
import { taskById } from "../../src/content/tasks";

async function drawGiraffe(page: Page) {
  await page.locator(".drawing-paper").scrollIntoViewIfNeeded();
  const canvas = (await page.getByTestId("canvas").boundingBox())!;
  const { scene } = taskById.giraffe;
  const region = scene.regions[0];
  const y = canvas.y + (region.y + region.height * 0.5) * canvas.height;
  await page.mouse.move(
    canvas.x + (region.x + region.width * 0.25) * canvas.width,
    y,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + (region.x + region.width * 0.75) * canvas.width,
    y,
    { steps: 8 },
  );
  await page.mouse.up();
}

test("機能拡張版の入口からFigma再現版を別のURLで開ける", async ({
  page,
  baseURL,
}) => {
  await page.goto("./");
  const link = page.getByRole("link", { name: "Figma再現版を開く" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new URL("replica/", baseURL!).href);
  await expect(page).toHaveTitle("ズーケッチ Figma再現版");
  const start = page.getByRole("button", { name: "はじめから", exact: true });
  await expect(start).toBeVisible();
  await expect(link).toHaveCount(0);
  await page.reload();
  await expect(start).toBeVisible();
});

test("Figma再現版をオフラインで開いても機能拡張版に切り替わらない", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.E2E_PREVIEW !== "1",
    "サービスワーカーは公開用ビルドで確認",
  );
  await page.goto("replica/");
  const start = page.getByRole("button", { name: "はじめから", exact: true });
  await expect(start).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 20_000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("ズーケッチ Figma再現版");
  await expect(start).toBeVisible();
  await page.goto("./");
  await expect(
    page.getByRole("link", { name: "Figma再現版を開く" }),
  ).toBeVisible();
});

test("再現版の見本撮影・描画・アルバムが拡張版の観察ノートから独立する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let cameraRequests = 0;
    Object.defineProperty(window, "replicaCameraRequests", {
      get: () => cameraRequests,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia() {
          cameraRequests++;
          return Promise.reject(new DOMException("denied", "NotAllowedError"));
        },
      },
    });
  });
  await page.goto("replica/");
  for (const name of [
    "はじめから",
    "こんにちは！",
    "やってみる！",
    "撮ってみる！",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  const shutter = page.getByRole("button", { name: "シャッター", exact: true });
  await shutter.click();
  await shutter.click();
  await expect(
    page.getByRole("img", { name: "見本写真のキリン" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "撮りなおす", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "キリンがいるよ！", exact: true }),
  ).toBeVisible();
  await shutter.click();
  await expect(
    page.getByRole("img", { name: "見本写真のキリン", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "replicaCameraRequests")),
  ).toBe(0);
  await page
    .getByRole("button", { name: "ピツネに見せる", exact: true })
    .click();
  await page.getByRole("button", { name: "描いてみる！", exact: true }).click();

  await drawGiraffe(page);
  await page.getByRole("button", { name: "できた！", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "上手に描けたね！" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "つぎへ", exact: true }).click();
  await page.getByRole("button", { name: "ありがとう！", exact: true }).click();
  await page.getByRole("button", { name: "ギャラリー", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "キリンのスケッチを見る" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "写真", exact: true }).click();
  const examplePhotos = page.getByRole("button", {
    name: "キリンの写真を見る",
    exact: true,
  });
  await expect(examplePhotos).toHaveCount(2);
  await examplePhotos.first().click();
  await expect(
    page.getByRole("img", { name: "見本写真", exact: true }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "つづきから", exact: true }).click();
  await page.getByRole("button", { name: "ギャラリー", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "キリンのスケッチを見る" }),
  ).toBeVisible();

  await page.goto("./");
  await page.getByRole("button", { name: /^図鑑を見る/ }).click();
  await expect(
    page.getByText("0枚の観察カードを保存しています。"),
  ).toBeVisible();
});

test("再現版の通常カメラで撮影・動物選択・写真を見返せる", async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [track] }),
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      srcObject: { configurable: true, set() {}, get: () => null },
      videoWidth: { configurable: true, get: () => 640 },
      videoHeight: { configurable: true, get: () => 480 },
      play: {
        configurable: true,
        value(this: HTMLVideoElement) {
          this.dispatchEvent(new Event("loadeddata"));
          return Promise.resolve();
        },
      },
    });
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: any[]) {
      if (args[0] instanceof HTMLVideoElement) {
        this.fillStyle = "#74bbb0";
        this.fillRect(0, 0, 640, 480);
        return;
      }
      return (drawImage as any).apply(this, args);
    };
  });
  await page.goto("replica/");
  await page.getByRole("button", { name: "つづきから", exact: true }).click();
  await page.getByRole("button", { name: "シャッター", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真" }),
  ).toHaveAttribute("src", /^data:image\/jpeg/);
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByRole("button", { name: "キリン", exact: true }).click();
  await page
    .getByRole("button", { name: "ピツネに見せる", exact: true })
    .click();
  await page.getByRole("button", { name: "描きはじめる", exact: true }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await drawGiraffe(page);
  await page.getByRole("button", { name: "できた！", exact: true }).click();
  await page.getByRole("button", { name: "写真を撮る", exact: true }).click();
  await page.getByRole("button", { name: "ギャラリー", exact: true }).click();
  await page.getByRole("tab", { name: "写真", exact: true }).click();
  await page
    .getByRole("button", { name: "キリンの写真を見る", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "撮影した写真", exact: true }),
  ).toBeVisible();
});

test("拡張版の任意ツールを使っても研究への同意は変わらない", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "設定", exact: true });
  await settings.getByText("追加の観察ツール", { exact: true }).click();
  await settings
    .getByText("描く前・後の気づきを比べる", { exact: true })
    .click();
  await settings.getByLabel("描く前に気づいたこと").fill("目が見えた。");
  await settings.getByLabel("描いた後に気づいたこと").fill("瞳が横長だった。");
  await settings.getByRole("button", { name: "気づきを見くらべる" }).click();
  await expect(
    settings.getByRole("definition").filter({ hasText: "瞳が横長だった。" }),
  ).toBeVisible();
  await settings.getByText("端末内の保存を確認", { exact: true }).click();
  await settings.getByRole("button", { name: "保存の読み書きを試す" }).click();
  await expect(
    settings.getByText("小さなデータの書き込みと読み取りに成功しました。"),
  ).toBeVisible();
  await settings.getByText("利用後の質問を試す", { exact: true }).click();
  await expect(
    settings.getByRole("form", { name: "利用後の質問" }),
  ).toHaveCount(0);
  await settings
    .getByRole("checkbox", {
      name: "説明を読み、試用アンケートの一時記録に同意します",
    })
    .check();
  await expect(
    settings.getByRole("form", { name: "利用後の質問" }),
  ).toBeVisible();
  await settings.getByText("研究への参加・記録", { exact: true }).click();
  await expect(
    settings.getByRole("checkbox", {
      name: "説明を読み、研究用の操作記録に同意します",
    }),
  ).not.toBeChecked();
});
