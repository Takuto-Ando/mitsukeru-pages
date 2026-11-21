import { expect, test, type Page } from "./fixtures";
import { penColorsFor } from "../../src/content/sketchPresentation";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test.beforeEach(async ({ page }) => {
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
});

async function openDrawing(page: Page, animal: string) {
  await page.goto("./");
  await button(page, "はじめから").click();
  await button(page, "シャッター").click();
  await button(page, "修正").click();
  await button(page, animal).click();
  await button(page, "ピツネに見せる").click();
  await page.getByTestId("canvas").waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test("ふりがなを切り替えても描画カードとボタンの位置・大きさが変わらない", async ({
  page,
}) => {
  await openDrawing(page, "キリン");
  const hint = button(page, "ヒントを見る");
  const complete = button(page, "できた！");
  const bounds = () =>
    Promise.all([
      page.locator(".sketch-frame").boundingBox(),
      hint.boundingBox(),
      complete.boundingBox(),
    ]);
  const hintReading = hint.locator("ruby[data-reading]").first();
  await expect(hintReading).toBeVisible();
  expect(
    await hintReading.evaluate(
      (element) => getComputedStyle(element, "::after").content,
    ),
  ).not.toBe("none");
  const on = await bounds();

  await page.evaluate(() => localStorage.setItem("zooketch-furigana-v1", "0"));
  await openDrawing(page, "キリン");
  await expect(hint.locator("rt")).toHaveCount(0);
  const off = await bounds();

  for (const [index, rect] of on.entries()) {
    expect(rect).not.toBeNull();
    expect(off[index]).not.toBeNull();
    for (const key of ["x", "y", "width", "height"] as const)
      expect(off[index]![key]).toBeCloseTo(rect![key], 0);
  }
});

test("キリンとヤギでペン色が変わり、太さ変更中だけ画面中央に見本を表示する", async ({
  page,
}) => {
  const tip = () => button(page, "ペン").locator("svg path").first();
  await openDrawing(page, "ヤギ・ヒツジ");
  await expect(tip()).toHaveAttribute("fill", penColorsFor("goat")[0]);
  await openDrawing(page, "キリン");
  await expect(tip()).toHaveAttribute("fill", "#6b5c7a");
  expect(penColorsFor("goat")[0]).not.toBe("#6b5c7a");

  const slider = page.getByRole("slider", { name: "ペンの太さ", exact: true });
  const preview = page.locator(".brush-width-preview");
  const track = (await slider.boundingBox())!;
  await expect(preview).toBeHidden();
  const x = track.x + track.width * 0.2;
  const y = track.y + track.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(preview).toBeVisible();
  const narrow = (await preview.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(narrow.x + narrow.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(narrow.y + narrow.height / 2).toBeCloseTo(viewport.height / 2, 0);
  await page.mouse.move(track.x + track.width * 0.9, y);
  await expect
    .poll(async () => (await preview.boundingBox())?.width)
    .toBeGreaterThan(narrow.width);
  await page.mouse.up();
  await expect(preview).toBeHidden();

  await slider.focus();
  await slider.press("ArrowLeft");
  await expect(preview).toBeVisible();
  await expect(preview).toBeHidden();
});

test("撮影・描画のセリフを強調し、京都市動物園と修正のルビを文字幅に収める", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./");
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d")!;
      let frame = 0;
      const paint = () => {
        context.fillStyle = frame++ % 2 ? "#74bbb0" : "#7dbbb0";
        context.fillRect(0, 0, canvas.width, canvas.height);
      };
      paint();
      const stream = canvas.captureStream(10);
      const timer = window.setInterval(() => {
        if (stream.active) paint();
        else window.clearInterval(timer);
      }, 100);
      return stream;
    };
  });
  await button(page, "はじめから").click();
  const accent = page.locator(".pitsune-bubble .pitsune-text-highlight");
  await expect(accent).toHaveText("動物の写真");
  await expect(accent).toHaveCSS("color", "rgb(249, 168, 70)");

  await expect(page.locator(".camera-frame video")).toBeVisible();
  await button(page, "シャッター").click();
  const labels = [
    button(page, "修正").locator("ruby[data-reading]"),
    page.locator('.design3-photo-card ruby[data-reading="きょうとし"]'),
    page.locator('.design3-photo-card ruby[data-reading="どうぶつえん"]'),
  ];
  await page.evaluate(() => document.fonts.ready);
  for (const label of labels) {
    await expect(label).toBeVisible();
    const widths = await label.evaluate((ruby) => {
      const style = getComputedStyle(ruby, "::after");
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = [style.fontWeight, style.fontSize, style.fontFamily].join(
        " ",
      );
      const aspect = Number(
        style.getPropertyValue("--ruby-aspect").trim() || 1,
      );
      return {
        reading:
          context.measureText(ruby.getAttribute("data-reading")!).width *
          aspect,
        kanji: ruby.getBoundingClientRect().width,
      };
    });
    expect(widths.reading).toBeLessThanOrEqual(widths.kanji + 0.25);
  }

  await button(page, "修正").click();
  await button(page, "キリン").click();
  await button(page, "ピツネに見せる").click();
  const titleRuby = page.locator(".design3-challenge h1 ruby").first();
  await expect(titleRuby).toBeVisible();
  expect(
    await titleRuby.evaluate((ruby) => getComputedStyle(ruby, "::after").color),
  ).toBe("rgb(255, 255, 255)");
  await expect(page.getByTestId("canvas")).toBeVisible();
  await expect(accent).toHaveText("舌");
  await expect(accent).toHaveCSS("color", "rgb(249, 168, 70)");
});
