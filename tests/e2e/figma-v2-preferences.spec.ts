import { expect, test } from "./fixtures";

test("年齢の自動設定・手動変更・チュートリアル再開と難易度に合う課題", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
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
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const screen = page.locator(".replica-app");
  await page.goto("./");
  await button("はじめから").click();
  const start = page.getByRole("dialog", { name: "年齢を教えてください" });
  await expect(start).toBeVisible();
  await expect(button("やさしい")).toHaveAttribute("aria-pressed", "true");
  await button("年齢を選ぶ").click();
  const ages = start.getByRole("group", { name: "年齢", exact: true });
  await expect(ages).toBeVisible();
  expect(
    await ages.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await ages.getByRole("button", { name: "10歳", exact: true }).click();
  await expect(button("ふりがな ON")).toHaveAttribute("aria-pressed", "true");
  await button("10歳").click();
  await ages.getByRole("button", { name: "11歳", exact: true }).click();
  await expect(button("ふりがな OFF")).toBeVisible();
  await expect(button("ふつう")).toHaveAttribute("aria-pressed", "true");
  await button("11歳").click();
  await ages.getByRole("button", { name: "18歳", exact: true }).click();
  await expect(button("むずかしい")).toHaveAttribute("aria-pressed", "true");
  await button("ふりがな OFF").click();
  await button("ふつう").click();
  await button("チュートリアルを始める").click();
  await expect(screen).toHaveAttribute("data-screen", "intro");

  await page.reload();
  await button("つづきから").click();
  await button("マイページ").click();
  const profile = page.getByRole("dialog", { name: "マイページ" });
  await expect(
    profile.getByRole("button", { name: "18歳", exact: true }),
  ).toBeVisible();
  await expect(button("ふりがな ON")).toBeVisible();
  await expect(button("ふつう")).toHaveAttribute("aria-pressed", "true");
  await button("端末に保存 ON").click();
  await expect(button("端末に保存 OFF")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await button("むずかしい").click();
  await button("チュートリアルを見る").click();
  await expect(screen).toHaveAttribute("data-screen", "intro");

  await page.reload();
  await button("つづきから").click();
  await button("マイページ").click();
  await expect(button("端末に保存 OFF")).toBeVisible();
  await profile.getByRole("button", { name: "設定を閉じる" }).click();
  await button("シャッター").click();
  await button("修正").click();
  await button("キリン").click();
  await button("ピツネに見せる").click();
  await expect(
    page.getByRole("heading", { name: "キリンの頭の角を描いてみよう！" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "難易度 3 / 3" })).toBeVisible();
});
