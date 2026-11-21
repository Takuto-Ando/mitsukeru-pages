import { expect, test, type Page } from "./fixtures";
import { taskById } from "../../src/content/tasks";

async function drawGiraffeTongue(page: Page) {
  const canvas = page.getByTestId("canvas");
  const bounds = (await canvas.boundingBox())!;
  const region = taskById.giraffe.scene.regions[0];
  for (let index = 0; index <= 20; index++) {
    const t = index / 20;
    await page.mouse.move(
      bounds.x + (region.x + region.width * (0.2 + 0.6 * t)) * bounds.width,
      bounds.y +
        (region.y + region.height * (0.25 + Math.sin(t * Math.PI) * 0.5)) *
          bounds.height,
    );
    if (!index) await page.mouse.down();
  }
  await page.mouse.up();
}

test("フローAは付録のノード順にタップで進み、描いた絵だけを送信して撮影へ合流する", async ({
  page,
}) => {
  const endpoint = "https://script.google.com/macros/s/zooketch-test/exec";
  await page.addInitScript((url) => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
    localStorage.setItem(
      "zooketch-share-v1",
      JSON.stringify({ consent: true, endpoint: url, token: "test" }),
    );
  }, endpoint);
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 200, body: '{"ok":true}' }),
  );
  await page.goto("./");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const shell = page.locator(".replica-app");
  const node = (id: string) => page.locator(`[data-figma-node="${id}"]`);
  await expect(shell).toHaveAttribute("data-figma-node", "28-100");
  await expect(button("つづきから")).toBeDisabled();
  await expect(
    page.getByText("Google連携（準備中）", { exact: true }),
  ).toHaveCount(0);
  await expect(
    button("つづきから").locator('img[src$="/figma/entry/google-g.svg"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /ドパガキ版|機能拡張版/ }),
  ).toHaveCount(0);
  const taglineRuby = page.locator(
    ".design3-title-tagline ruby[data-reading=ゆびさき]",
  );
  await expect(taglineRuby).toBeVisible();
  expect(
    await taglineRuby.evaluate(
      (ruby) => getComputedStyle(ruby, "::after").content,
    ),
  ).toBe('"ゆびさき"');
  await button("はじめから").click();
  await expect(button("スキップ")).toHaveCount(0);
  for (const [id, choice] of [
    ["29-683", "こんにちは！"],
    ["36-778", "やってみる！"],
    ["38-898", "撮ってみる！"],
  ]) {
    await expect(node(id)).toBeVisible();
    await button(choice).click();
  }
  await expect(node("43-1681")).toBeVisible();
  await expect(button("マイページ")).toBeDisabled();
  await button("シャッター").click();
  await expect(node("43-1745")).toBeVisible();
  await button("シャッター").click();
  await expect(node("43-1815")).toBeVisible();
  const photoSize = await page
    .getByRole("img", { name: "見本写真のキリン", exact: true })
    .evaluate(async (element: HTMLImageElement) => {
      await element.decode();
      return [element.naturalWidth, element.naturalHeight];
    });
  expect(photoSize[0] * 5).toBe(photoSize[1] * 4);
  await expect(page.locator(".design3-photo-card")).toHaveAttribute(
    "data-photo-shine",
    "true",
  );
  await expect(page.getByText("きらりん", { exact: true })).toHaveCount(0);
  await expect(button("撮りなおす")).toBeDisabled();
  await button("ピツネに見せる").click();
  await expect(node("52-5335")).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(node("52-5335")).toBeVisible();
  await expect(page.locator(".photo-animal-bubble")).toHaveCount(0);
  await page
    .locator(".photo-celebration-tap")
    .click({ position: { x: 100, y: 100 } });
  await expect(node("38-1056")).toBeVisible();
  await button("描いてみる！").click();
  await expect(node("52-5984")).toBeVisible();
  await expect(
    node("52-5984")
      .getByRole("img", { name: "難易度 1 / 3" })
      .locator(".card-lettering-text"),
  ).toHaveCSS("color", "rgb(249, 168, 70)");
  await expect(button("描きはじめる")).toHaveCount(0);
  await page.waitForTimeout(3200);
  await expect(node("52-5984")).toBeVisible();
  const canvas = page.getByTestId("canvas");
  await expect(canvas).toHaveCount(0);
  await button("課題を確認してつぎへ").click();
  await expect(node("43-1966")).toBeVisible();
  await expect(canvas).toBeVisible();
  await drawGiraffeTongue(page);
  const sending = page.waitForRequest((request) => request.url() === endpoint);
  await button("できた！").click();
  await expect(node("66-8363")).toBeVisible();
  await expect(button("描きなおす")).toBeDisabled();
  await expect(button("もう一度見る")).toHaveCount(0);
  const payload = (await sending).postDataJSON();
  expect(payload.pngBase64).toMatch(/^iVBOR/);
  expect(payload.strokes.length).toBeGreaterThan(0);
  expect(payload).not.toHaveProperty("photo");
  await button("つぎへ").click();
  await expect(node("43-1269")).toBeVisible();
  await button("ありがとう！").click();
  await expect(node("38-1026")).toBeVisible();
  await button("ギャラリー").click();
  await expect(node("63-6390")).toBeVisible();
  await button("キリンのスケッチを見る").click();
  const galleryDetail = page.getByRole("dialog");
  await expect(
    galleryDetail
      .getByRole("img", { name: "難易度 1 / 3" })
      .locator(".card-lettering-text"),
  ).toHaveCSS("color", "rgb(249, 168, 70)");
  await galleryDetail.getByRole("button", { name: "一覧に戻る" }).click();
  await page.getByRole("tab", { name: "写真", exact: true }).click();
  await expect(node("66-10991")).toBeVisible();
  await button("写真を撮る").click();
  await expect(node("38-1026")).toBeVisible();
});

test("フローBは写真確認から通常の難易度選択と描画を通って撮影に戻る", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v1", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("./");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const node = (id: string) => page.locator(`[data-figma-node="${id}"]`);
  await button("はじめから").click();
  await expect(node("38-1026")).toBeVisible();
  await button("シャッター").click();
  await expect(node("66-7655")).toBeVisible();
  await button("修正").click();
  await expect(node("66-7604")).toBeVisible();
  await button("キリン").click();
  await expect(node("66-7554")).toBeVisible();
  await button("ピツネに見せる").click();
  await expect(node("43-1903")).toBeVisible();
  await button("スケッチの準備を確認してつぎへ").click();
  await expect(node("66-8272")).toBeVisible();
  await button("課題を確認してつぎへ").click();
  await expect(node("66-7869")).toBeVisible();
  await button("ヒントを見る").click();
  await expect(node("66-8070")).toBeVisible();
  const slider = page.getByRole("slider", { name: "ペンの太さ" });
  await slider.press("ArrowRight");
  const preview = page.locator(".brush-width-preview");
  await expect(slider).toHaveAttribute("aria-valuetext", "11");
  await expect(preview).toBeVisible();
  const previewBox = (await preview.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(previewBox.x + previewBox.width / 2).toBeCloseTo(
    viewport.width / 2,
    0,
  );
  expect(previewBox.y + previewBox.height / 2).toBeCloseTo(
    viewport.height / 2,
    0,
  );
  await expect(preview).toHaveCSS("--preview-ink", "#6b5c7a");
  await expect(preview).toHaveCount(0);

  // A short stroke is enough to complete the flow without a self-check screen.
  const bounds = (await page.getByTestId("canvas").boundingBox())!;
  const region = taskById.giraffe.scene.regions[0];
  const x = bounds.x + (region.x + region.width / 2) * bounds.width;
  const y = bounds.y + (region.y + region.height / 2) * bounds.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 4 });
  await page.mouse.up();
  await button("できた！").click();
  await expect(node("66-10524")).toBeVisible();
  await expect(page.getByText("スケッチができたね！")).toBeVisible();
  await expect(page.getByText("実物でも、こんな形に見えた？")).toHaveCount(0);
  await expect(button("つぎへ")).toHaveCount(0);
  await button("写真を撮る").click();
  await expect(node("38-1026")).toBeVisible();
});

test("旧URLからも同一本体が開き、設定でふりがなをOFFにできる", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("zooketch-replica-tutorial-v1", "1"),
  );
  for (const url of ["./", "plus/", "dopa/", "figma/"]) {
    await page.goto(url);
    await expect(page.locator("[data-variant=product]")).toHaveAttribute(
      "data-screen",
      "title",
    );
    await expect(
      page.getByRole("link", { name: /ドパガキ版|機能拡張版/ }),
    ).toHaveCount(0);
  }
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  const profile = page.getByRole("button", { name: "マイページ", exact: true });
  await profile.click();
  const settings = page.getByRole("dialog", { name: "設定" });
  const settingsAction = settings.getByRole("button", { name: "体験に戻る" });
  const layoutBefore = await settingsAction.boundingBox();
  expect(layoutBefore).not.toBeNull();
  await expect(settingsAction.locator("ruby").first()).toBeVisible();
  await settings
    .getByRole("button", { name: "ふりがな ON", exact: true })
    .click();
  await expect(
    settings.getByRole("button", { name: "ふりがな OFF", exact: true }),
  ).toBeVisible();
  await expect(settingsAction.locator("ruby")).toHaveCount(0);
  expect(await settingsAction.boundingBox()).toEqual(layoutBefore);
  await expect(settingsAction).toHaveCSS("font-family", /Zen Maru Gothic/);
  await settings.getByText("絵の自動送信（研究用）", { exact: true }).click();
  await expect(settings.getByRole("checkbox")).not.toBeChecked();
});
