import type { Locator } from "@playwright/test";
import { expect, mockTutorialModels, test, type Page } from "./fixtures";
import { taskById } from "../../src/content/tasks";

function usesProductionShare(baseURL: string): boolean {
  return process.env.E2E_PREVIEW === "1" || baseURL.startsWith("https://");
}

async function expectLicensedTypeface(page: Page, selector: string) {
  if (!process.env.VITE_ADOBE_FONTS_KIT_ID) return;
  await expect(page.locator("html")).toHaveAttribute("data-ui-font", "dnp");
  await expect(page.locator(selector)).toHaveCSS(
    "font-family",
    /^"?dnp-shuei-mgothic-std"?[, ]/,
  );
  await expect(page.locator(selector)).toHaveCSS("font-weight", "600");
  const adobeFace = await page.evaluate(() =>
    [...document.fonts].some(
      (face) =>
        face.family.replace(/["']/g, "") === "dnp-shuei-mgothic-std" &&
        face.weight === "600" &&
        face.status === "loaded",
    ),
  );
  expect(adobeFace).toBe(true);
}

async function expectPitsuneFace(
  button: Locator,
  addedGap: number,
  faceColor: number[],
) {
  const icon = button.locator(".pitsune-cta-icon");
  await expect(icon).toBeVisible();
  const position = await icon.evaluate((image) => {
    const iconBounds = image.getBoundingClientRect();
    const label = image.nextElementSibling!.getBoundingClientRect();
    const buttonGap = parseFloat(
      getComputedStyle(image.parentElement!).columnGap,
    );
    return {
      centerOffset:
        iconBounds.y + iconBounds.height / 2 - (label.y + label.height / 2),
      addedGap: label.x - iconBounds.right - buttonGap,
    };
  });
  expect(position.centerOffset).toBeCloseTo(-1, 1);
  expect(position.addedGap).toBeCloseTo(addedGap, 1);
  const colors = await icon.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 74;
    canvas.height = 68;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Sample the centers of the left eye, right eye, and nose.
    return [
      [26, 46],
      [48, 46],
      [37, 49],
    ].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
  });
  expect(colors).toEqual(Array(3).fill(faceColor));
}

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

test("フローAは付録のノード順に進み、描いた絵だけを送信して撮影へ合流する", async ({
  page,
}) => {
  await mockTutorialModels(page);
  const base = test.info().project.use.baseURL!;
  const production = usesProductionShare(base);
  const endpoint = production
    ? new URL(
        new URL(base).origin === "https://takuto-ando.github.io"
          ? "https://zooketch.pages.dev/__zooketch-share"
          : "__zooketch-share",
        base,
      ).href
    : "https://script.google.com/macros/s/zooketch-test/exec";
  await page.addInitScript(
    ({ url, production }) => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: async () => {
            throw new DOMException("Permission denied", "NotAllowedError");
          },
        },
      });
      if (!production)
        localStorage.setItem(
          "zooketch-share-v1",
          JSON.stringify({ consent: true, endpoint: url, token: "test" }),
        );
    },
    { url: endpoint, production },
  );
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 204,
      headers: { "Access-Control-Allow-Origin": new URL(base).origin },
    }),
  );
  await page.goto("./");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const shell = page.locator(".replica-app");
  const node = (id: string) => page.locator(`[data-figma-node="${id}"]`);
  await expect(shell).toHaveAttribute("data-figma-node", "28-100");
  await expectLicensedTypeface(page, ".design3-title-tagline");
  await expect(button("つづきから")).toBeEnabled();
  await expect(
    page.getByText("Google連携（準備中）", { exact: true }),
  ).toHaveCount(0);
  await expect(
    button("つづきから").locator('img[src$="/figma/entry/google-g.svg"]'),
  ).toHaveCount(0);
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
  if (process.env.VITE_ADOBE_FONTS_KIT_ID) {
    expect(
      await taglineRuby.evaluate(
        (ruby) => getComputedStyle(ruby, "::after").fontWeight,
      ),
    ).toBe("600");
  }
  await button("はじめから").click();
  await button("決定！").click();
  await expect(button("スキップ")).toHaveCount(0);
  for (const [index, [id, choice]] of [
    ["29-683", "こんにちは！"],
    ["36-778", "やってみる！"],
    ["38-898", "撮ってみる！"],
  ].entries()) {
    await expect(node(id)).toBeVisible();
    const progress = page.getByRole("img", {
      name: `チュートリアル ${index + 1} / 5`,
    });
    await expect(progress.locator("span")).toHaveCount(5);
    await expect(progress.locator("[data-reached]")).toHaveCount(index + 1);
    await expect(button(choice).locator(".intro-action-icon")).toBeVisible();
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
  await expect(button("撮りなおす")).toBeEnabled();
  await button("撮りなおす").click();
  await expect(node("43-1745")).toBeVisible();
  await button("シャッター").click();
  await expect(node("43-1815")).toBeVisible();
  await expectPitsuneFace(button("描いてもらう"), 2, [249, 168, 70, 255]);
  await button("描いてもらう").click();
  await expect(node("52-5335")).toHaveCount(0);
  await expect(page.locator(".design3-photo-celebration")).toHaveCount(0);
  await expect(page.locator(".photo-animal-bubble")).toHaveCount(0);
  await expect(node("38-1056")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "チュートリアル 4 / 5" }),
  ).toBeVisible();
  await expect(
    button("描いてみる！").locator(".intro-action-icon"),
  ).toBeVisible();
  await button("描いてみる！").click();
  await expect(node("52-5984")).toBeVisible();
  await expectLicensedTypeface(
    page,
    ".design3-challenge-prompt .card-lettering-text",
  );
  await expect(
    node("52-5984")
      .getByRole("img", { name: "難易度 1 / 3" })
      .locator(".card-lettering-text"),
  ).toHaveCSS("color", "rgb(249, 168, 70)");
  await expect(button("描きはじめる")).toHaveCount(0);
  await expect(button("課題を確認してつぎへ")).toBeVisible();
  const canvas = page.getByTestId("canvas");
  await expect(node("43-1966")).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("group", { name: "拡大・縮小" })).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: "ペンの太さ" }),
  ).toHaveAttribute("aria-valuetext", "8");
  await drawGiraffeTongue(page);
  const sending = page.waitForRequest((request) => request.url() === endpoint);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await button("できた！").click();
  const celebration = page.locator('[data-purpose="sketch"]');
  await expect(celebration).toBeVisible();
  await expect(canvas).toBeVisible();
  const starGroups = celebration.locator(".photo-celebration-stars");
  await expect(starGroups).toHaveCount(2);
  await expect(starGroups.first()).toHaveCSS("animation-delay", "0.1s");
  await expect(starGroups.last()).toHaveCSS("animation-delay", "0.1s");
  await button("スケッチの結果を見る").click();
  await expect(node("66-8363")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(button("描きなおす")).toBeEnabled();
  await button("描きなおす").click();
  await expect(node("43-1966")).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(button("できた！")).toBeEnabled();
  await button("できた！").click();
  await button("スケッチの結果を見る").click();
  await expect(node("66-8363")).toBeVisible();
  await expect(button("もう一度見る")).toHaveCount(0);
  const payload = (await sending).postDataJSON();
  expect(payload.pngBase64).toMatch(/^iVBOR/);
  expect(payload.strokes.length).toBeGreaterThan(0);
  expect(payload).not.toHaveProperty("photo");
  if (production) expect(payload).not.toHaveProperty("token");
  await expectPitsuneFace(button("つぎへ"), 0, [121, 91, 66, 255]);
  await button("つぎへ").click();
  await expect(node("43-1269")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "チュートリアル 5 / 5" }),
  ).toBeVisible();
  await expect(
    button("ありがとう！").locator(".intro-action-icon"),
  ).toBeVisible();
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
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const node = (id: string) => page.locator(`[data-figma-node="${id}"]`);
  await button("つづきから").click();
  await expect(node("38-1026")).toBeVisible();
  await button("シャッター").click();
  await expect(node("66-7655")).toBeVisible();
  await button("修正").click();
  await expect(node("66-7604")).toBeVisible();
  await button("キリン").click();
  await expect(node("66-7554")).toBeVisible();
  await button("描いてもらう").click();
  await expect(node("43-1903")).toBeVisible();
  await expect(node("66-8272")).toBeVisible();
  await expect(node("66-7869")).toBeVisible();
  await button("ヒントを見る").click();
  await expect(node("66-8070")).toBeVisible();
  const slider = page.getByRole("slider", { name: "ペンの太さ" });
  await slider.press("ArrowRight");
  const preview = page.locator(".brush-width-preview");
  await expect(slider).toHaveAttribute("aria-valuetext", "12");
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
  await expect(page.locator('[data-purpose="sketch"]')).toBeVisible();
  await expect(node("66-10524")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "なんでこんな形なのかな？" }),
  ).toBeVisible();
  await expect(page.getByText("実物でも、こんな形に見えた？")).toHaveCount(0);
  await expect(button("つぎへ")).toHaveCount(0);
  await button("写真を撮る").click();
  await expect(node("38-1026")).toBeVisible();
});

test("旧URLからも同一本体が開き、設定でふりがなをOFFにできる", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("zooketch-replica-tutorial-v2", "1"),
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
  await page.getByRole("button", { name: "つづきから", exact: true }).click();
  const profile = page.getByRole("button", { name: "マイページ", exact: true });
  await profile.click();
  const settings = page.getByRole("dialog", { name: "マイページ" });
  const settingsAction = settings.getByRole("button", { name: "体験に戻る" });
  await expectLicensedTypeface(page, ".settings-dialog h2");
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
  await settings.getByText("絵の自動送信（研究用）", { exact: true }).click();
  const consent = settings.getByRole("checkbox");
  if (usesProductionShare(test.info().project.use.baseURL!)) {
    await expect(consent).toBeChecked();
    await expect(settings.getByLabel(/送信先URL|トークン/)).toHaveCount(0);
    await consent.uncheck();
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("zooketch-share-v1") ?? "{}"),
        ),
      )
      .toEqual({ consent: false });
  } else {
    await expect(consent).not.toBeChecked();
  }
});

test("スケッチ準備と課題タイトルをタップすると描画へ進める", async ({
  page,
}) => {
  await mockTutorialModels(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const shell = page.locator(".replica-app");
  await page.goto("./");
  await button("はじめから").click();
  await button("決定！").click();
  await button("こんにちは！").click();
  await button("やってみる！").click();
  await button("撮ってみる！").click();
  await button("シャッター").click();
  await button("シャッター").click();
  await button("描いてもらう").click();
  await expect(shell).toHaveAttribute("data-screen", "easel");
  await button("描いてみる！").click();
  await expect(shell).toHaveAttribute("data-screen", "challenge");
  await button("課題を確認してつぎへ").click({ position: { x: 100, y: 100 } });
  await expect(page.getByTestId("canvas")).toBeVisible();

  await page.evaluate(() =>
    localStorage.setItem("zooketch-replica-tutorial-v2", "1"),
  );
  await page.reload();
  await button("つづきから").click();
  await button("シャッター").click();
  await button("修正").click();
  await button("キリン").click();
  await button("描いてもらう").click();
  await expect(shell).toHaveAttribute("data-screen", "easel");
  await button("スケッチの準備を確認してつぎへ").click({
    position: { x: 100, y: 100 },
  });
  await expect(shell).toHaveAttribute("data-screen", "challenge");
});
