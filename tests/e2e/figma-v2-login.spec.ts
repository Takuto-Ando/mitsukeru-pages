import { expect, test } from "./fixtures";

test("つづきからはログインも年齢入力も挟まず撮影を開く", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./");
  const resume = page.getByRole("button", { name: "つづきから", exact: true });
  await expect(resume.locator(".design3-title-resume-mark")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Googleログインのデモ" }),
  ).toHaveCount(0);
  await resume.click();
  await expect(page.getByRole("button", { name: "シャッター" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "年齢を教えてください" }),
  ).toHaveCount(0);
});
