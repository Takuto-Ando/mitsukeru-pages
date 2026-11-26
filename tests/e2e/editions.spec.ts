import { expect, test, type Page } from "./fixtures";
import { taskById } from "../../src/content/tasks";
import { tutorialSurveyUrl } from "../../src/research/tutorialSurvey";

async function drawGiraffe(page: Page, shape: "curve" | "line" = "curve") {
  await page.locator(".drawing-paper").scrollIntoViewIfNeeded();
  const canvas = (await page.getByTestId("canvas").boundingBox())!;
  const { scene } = taskById.giraffe;
  const region = scene.regions[0];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const y = shape === "curve" ? 0.25 + Math.sin(t * Math.PI) * 0.5 : 0.5;
    await page.mouse.move(
      canvas.x + (region.x + region.width * (0.2 + 0.6 * t)) * canvas.width,
      canvas.y + (region.y + region.height * y) * canvas.height,
    );
    if (!i) await page.mouse.down();
  }
  await page.mouse.up();
}

async function expectGiraffeChallenge(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: "キリンの舌を描いてみよう！",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "難易度 1 / 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("canvas")).toHaveCount(0);
}

test("旧版から課題の直接リンクとQRの入口を取り除く", async ({ page }) => {
  await page.goto("plus/#task=giraffe");
  await expect(
    page.getByRole("button", { name: "はじめから", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".design3-challenge")).toHaveCount(0);
  await expect(page.getByTestId("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "QRで課題を開く", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(
    page.getByText("動物ごとの課題リンク（QRポスター用）", { exact: true }),
  ).toHaveCount(0);
});

test("機能拡張版の入口からFigma再現版を別のURLで開ける", async ({
  page,
  baseURL,
}) => {
  await page.goto("plus/");
  await expect(page).toHaveTitle("ズーケッチ");
  const link = page.getByRole("link", { name: "Figma再現版を開く" });
  await expect(link).toBeVisible();
  const titleScreen = page.getByRole("region", {
    name: "ズーケッチのタイトル",
  });
  await expect(titleScreen).toHaveCSS("background-color", "rgb(255, 250, 240)");
  await link.click();
  await expect(page).toHaveURL(new URL("figma/", baseURL!).href);
  await expect(page).toHaveTitle("ズーケッチ Figma再現版");
  const start = page.getByRole("button", { name: "はじめから", exact: true });
  await expect(start).toBeVisible();
  await expect(titleScreen).toHaveCSS("background-color", "rgb(255, 250, 240)");
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
  await page.goto("figma/");
  const start = page.getByRole("button", { name: "はじめから", exact: true });
  await expect(start).toBeVisible();
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined),
  );
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 20_000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("ズーケッチ Figma再現版");
  await expect(start).toBeVisible();
  await page.goto("plus/");
  await expect(
    page.getByRole("link", { name: "Figma再現版を開く" }),
  ).toBeVisible();
  await page.goto("replica/");
  await expect(page).toHaveTitle("ズーケッチ Figma再現版");
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
  await page.goto("figma/");
  for (const name of [
    "はじめから",
    "こんにちは！",
    "やってみる！",
    "撮ってみる！",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  const tutorialGallery = page.getByRole("button", {
    name: "ギャラリー",
    exact: true,
  });
  await expect(tutorialGallery).toBeDisabled();
  await expect(tutorialGallery).toHaveCSS("opacity", "0.5");
  await expect(
    page.locator(".camera-frame .design3-camera-guides"),
  ).toHaveCount(0);
  const shutter = page.getByRole("button", { name: "シャッター", exact: true });
  await shutter.click();
  await expect(
    page.locator(".camera-frame .design3-camera-guides"),
  ).toBeVisible();
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
  await expect(page.locator(".photo-animal-bubble")).toHaveCount(0);
  await expect(
    page.locator(".design3-celebration-mascot .lucide-star"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "描いてみる！", exact: true }).click();
  await expectGiraffeChallenge(page);
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 6000 });

  await drawGiraffe(page, "line");
  await page.getByRole("button", { name: "できた！", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "実物でも、こんな形に見えた？" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "つぎへ", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "自分の絵", exact: true }).click();
  await page.getByRole("button", { name: "お手本", exact: true }).click();
  await page.getByRole("button", { name: "描きなおす", exact: true }).click();
  await page.getByRole("button", { name: "ひとつ戻す", exact: true }).click();
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
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
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

test("Figma再現版の検証用チュートリアルからだけGoogleフォームへ進める", async ({
  page,
}) => {
  const form = tutorialSurveyUrl("?study=1", process.env.VITE_STUDY_FORM_URL);
  test.skip(!form, "回答用Googleフォームを指定したビルドで検証する");
  let visits = 0;
  await page.route(form!, async (route) => {
    visits++;
    await route.fulfill({
      contentType: "text/html",
      body: "<h1>Mock study survey</h1>",
    });
  });
  await page.goto("figma/?study=1");
  await expect(
    page.getByText("チュートリアルのあと、Googleフォームが開きます。"),
  ).toBeVisible();
  for (const name of [
    "はじめから",
    "こんにちは！",
    "やってみる！",
    "撮ってみる！",
    "シャッター",
    "シャッター",
    "ピツネに見せる",
    "描いてみる！",
    "描きはじめる",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await drawGiraffe(page, "line");
  await page.getByRole("button", { name: "できた！", exact: true }).click();
  await page
    .getByRole("button", { name: "見くらべて、確かめた！", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "見くらべて、確かめたね。" }),
  ).toBeVisible();
  expect(visits).toBe(0);
  await page.getByRole("button", { name: "つぎへ", exact: true }).click();
  await expect(page).toHaveURL(form!);
  expect(visits).toBe(1);
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
  await page.goto("figma/");
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "0.5×", exact: true }),
  ).toBeDisabled();
  const zoom = page.getByRole("button", { name: "2×", exact: true });
  await zoom.click();
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".replica-camera video")).toHaveCSS(
    "transform",
    "matrix(2, 0, 0, 2, 0, 0)",
  );
  await page.getByRole("button", { name: "シャッター", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真" }),
  ).toHaveAttribute("src", /^data:image\/jpeg/);
  await expect
    .poll(() =>
      page
        .locator(".captured-preview")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(320);
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByRole("button", { name: "キリン", exact: true }).click();
  await page
    .getByRole("button", { name: "ピツネに見せる", exact: true })
    .click();
  await expectGiraffeChallenge(page);
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

test("拡張版でキリンを選ぶと描画の前に舌の課題と難易度を確認できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("denied", "NotAllowedError")),
      },
    });
  });
  await page.goto("plus/");
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  await page
    .getByRole("button", { name: "写真なしで始める", exact: true })
    .click();
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByRole("button", { name: "キリン", exact: true }).click();
  await page
    .getByRole("button", { name: "ピツネに見せる", exact: true })
    .click();
  await expectGiraffeChallenge(page);
  await page.getByRole("button", { name: "描きはじめる", exact: true }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
});

test("設定から任意ツールを取り除き、研究の同意と絵の送信設定を残す", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "設定", exact: true });
  await expect(
    settings.getByText("追加の観察ツール", { exact: true }),
  ).toHaveCount(0);
  await expect(
    settings.getByText("絵の自動送信（研究用）", { exact: true }),
  ).toBeVisible();
  await settings.getByText("研究への参加・記録", { exact: true }).click();
  await expect(
    settings.getByRole("checkbox", {
      name: "説明を読み、研究用の操作記録に同意します",
    }),
  ).not.toBeChecked();
});

test("読み仮名は既定で表示され、チュートリアルだけマイページを押せない", async ({
  page,
}) => {
  await page.goto("figma/");
  const ruby = page.locator(".design3-title-tagline ruby");
  await expect(ruby.filter({ hasText: "指先" }).locator("rt")).toHaveAttribute(
    "data-reading",
    "ゆびさき",
  );
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await expect(page.locator(".entry-caption-line")).toHaveCount(2);
  await page.getByRole("button", { name: "こんにちは！", exact: true }).click();
  await page.getByRole("button", { name: "やってみる！", exact: true }).click();
  await page.getByRole("button", { name: "撮ってみる！", exact: true }).click();
  const profile = page.getByRole("button", { name: "マイページ", exact: true });
  await expect(profile).toBeDisabled();
  await expect(profile).toHaveCSS("opacity", "0.5");
  const zoom = page.getByRole("button", { name: "2×", exact: true });
  const drift = await zoom.evaluate((button) => {
    const origin = button.getBoundingClientRect();
    const circle = getComputedStyle(button, "::before");
    const label = button.querySelector(".zoom-text")!.getBoundingClientRect();
    return Math.hypot(
      origin.x + Number.parseFloat(circle.left) - (label.x + label.width / 2),
      origin.y + Number.parseFloat(circle.top) - (label.y + label.height / 2),
    );
  });
  expect(drift).toBeLessThan(0.6);
});
