import { expect, test } from "./fixtures";

test("課題の背景だけが動き、同じ吹き出しのふりがなは高さがそろう", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
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
  await page.goto("./");
  await button("はじめから").click();
  await button("シャッター").click();
  await button("修正").click();
  await button("キリン").click();
  await button("ピツネに見せる").click();
  await button("スケッチの準備を確認してつぎへ").click();

  const challenge = page.locator(".design3-challenge");
  await expect(challenge).toBeVisible();
  const pattern = () =>
    challenge.evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      return {
        animation: style.animationName,
        opacity: style.opacity,
        pointer: style.pointerEvents,
      };
    });
  expect(await pattern()).toEqual({
    animation: "sketch-pattern-drift",
    opacity: "0.2",
    pointer: "none",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await pattern()).animation).toBe("none");
  await button("課題を確認してつぎへ").click();
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 15_000 });
  const ruby = page.locator(".mission-pitsune-row ruby[data-reading]");
  expect(await ruby.count()).toBeGreaterThan(1);
  expect(
    await ruby.evaluateAll(
      (elements) =>
        new Set(
          elements.map((element) =>
            getComputedStyle(element, "::after").getPropertyValue("font-size"),
          ),
        ).size,
    ),
  ).toBe(1);
});
