import { expect, test } from "./fixtures";

test("つづきからのGoogleログインデモは認証情報なしで完了しタイトルに戻る", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./");
  const resume = page.getByRole("button", { name: "つづきから", exact: true });
  const dialog = page.getByRole("dialog", { name: "Googleログインのデモ" });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "accounts.google.com")
      requests.push(request.url());
  });

  await resume.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("input, form, a")).toHaveCount(0);
  await dialog.getByRole("button", { name: "サンプルでつづける" }).click();
  await expect(dialog.getByRole("status")).toHaveText("デモが完了しました。");
  await dialog.getByRole("button", { name: "タイトルに戻る" }).click();
  await expect(dialog).toBeHidden();
  await expect(resume).toBeFocused();
  await expect(page).toHaveURL(
    new URL("./", test.info().project.use.baseURL!).href,
  );
  expect(requests).toEqual([]);

  await resume.click();
  await expect(
    dialog.getByRole("button", { name: "サンプルでつづける" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
