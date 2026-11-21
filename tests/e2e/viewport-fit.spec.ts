import { expect, test } from "./fixtures";

test("縦画面でホーム・カメラ・写真確認・描画の主操作がスクロールせず使える", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
  });
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const fits = async () => {
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollHeight - innerHeight,
        ),
      )
      .toBeLessThanOrEqual(1);
  };
  await page.goto("plus/");
  await expect(button("はじめから")).toBeVisible();
  await fits();
  await button("はじめから").click();
  await expect(button("こんにちは！")).toBeInViewport();
  await fits();
  await button("スキップ").click();
  await expect(button("シャッター")).toBeInViewport();
  await expect(button("自由に描く")).toBeInViewport();
  await fits();
  await button("写真なしで始める").click();
  await expect(button("ピツネに見せる")).toBeInViewport();
  await fits();
  await button("修正").click();
  await button("キリン").click();
  await button("ピツネに見せる").click();
  await button("描きはじめる").click();
  await expect(page.getByTestId("canvas")).toBeInViewport();
  await expect(button("できた！")).toBeInViewport();
  await fits();
  await button("ヒントを見る").click();
  await expect(page.getByRole("note")).toBeInViewport();
  await fits();
});
