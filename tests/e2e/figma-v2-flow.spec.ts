import { expect, test } from "./fixtures";
import { taskById } from "../../src/content/tasks";

test("初回はタップで進み、描いた絵だけを送信して撮影ホームに戻る", async ({
  page,
}) => {
  const endpoint = "https://script.google.com/macros/s/zooketch-test/exec";
  await page.addInitScript((url) => {
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
  await expect(shell).toHaveAttribute("data-screen", "title");
  await expect(
    page.getByRole("link", { name: /ドパガキ版|機能拡張版/ }),
  ).toHaveCount(0);
  await expect(
    page.locator(".design3-title-tagline rt[data-reading=ゆびさき]"),
  ).toBeVisible();
  await button("はじめから").click();
  await expect(button("スキップ")).toHaveCount(0);
  for (const choice of ["こんにちは！", "やってみる！", "撮ってみる！"]) {
    await button(choice).click();
  }
  await expect(button("マイページ")).toBeDisabled();
  await button("シャッター").click();
  await button("シャッター").click();
  await expect(button("撮りなおす")).toBeDisabled();
  await button("ピツネに見せる").click();
  await expect(shell).toHaveAttribute("data-screen", "cheer");
  await page.waitForTimeout(1400);
  await expect(shell).toHaveAttribute("data-screen", "cheer");
  await expect(page.locator(".photo-animal-bubble")).toHaveCount(0);
  await page
    .locator(".photo-celebration-tap")
    .click({ position: { x: 100, y: 100 } });
  await button("描いてみる！").click();
  await expect(button("描きはじめる")).toHaveCount(0);
  const canvas = page.getByTestId("canvas");
  await expect(canvas).toBeVisible();
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
  await button("できた！").click();
  await expect(button("描きなおす")).toBeDisabled();
  await expect(button("もう一度見る")).toHaveCount(0);
  const sending = page.waitForRequest((request) => request.url() === endpoint);
  await button("つぎへ").click();
  const payload = (await sending).postDataJSON();
  expect(payload.pngBase64).toMatch(/^iVBOR/);
  expect(payload.strokes.length).toBeGreaterThan(0);
  expect(payload).not.toHaveProperty("photo");
  await button("ありがとう！").click();
  await expect(shell).toHaveAttribute("data-screen", "camera");
  await button("ギャラリー").click();
  await expect(button("キリンのスケッチを見る")).toBeVisible();
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
  await page.getByRole("button", { name: "マイページ", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings
    .getByRole("button", { name: "ふりがな ON", exact: true })
    .click();
  await expect(
    settings.getByRole("button", { name: "ふりがな OFF", exact: true }),
  ).toBeVisible();
  await settings.getByText("絵の自動送信（研究用）", { exact: true }).click();
  await expect(settings.getByRole("checkbox")).not.toBeChecked();
});
