import { expect, test } from "./fixtures";

test("描画中は二本目の指で消しゴムが飛ばない", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("./");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await button("つづきから").click();
  await button("シャッター").click();
  await button("修正").click();
  await button("キリン").click();
  await button("描いてもらう").click();
  await button("スケッチの準備を確認してつぎへ").click();
  await button("課題を確認してつぎへ").click();
  const canvas = page.getByTestId("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS("touch-action", "none");
  await button("消しゴム").click();
  const positions = await canvas.evaluate((element) => {
    const ring =
      element.parentElement!.querySelector<HTMLElement>(".eraser-ring")!;
    const rect = element.getBoundingClientRect();
    function pointer(type: string, pointerId: number, ratio: number) {
      element.dispatchEvent(
        new PointerEvent(type, {
          pointerType: "touch",
          pointerId,
          isPrimary: pointerId === 1,
          button: 0,
          clientX: rect.left + rect.width * ratio,
          clientY: rect.top + rect.height * ratio,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    pointer("pointerdown", 1, 0.5);
    const first = ring.style.transform;
    pointer("pointerdown", 2, 0.8);
    pointer("pointermove", 2, 0.85);
    const afterPalm = ring.style.transform;
    pointer("pointermove", 1, 0.55);
    const afterFirstMove = ring.style.transform;
    pointer("pointerup", 1, 0.55);
    return { first, afterPalm, afterFirstMove };
  });
  expect(positions.first).not.toBe("");
  expect(positions.afterPalm).toBe(positions.first);
  expect(positions.afterFirstMove).not.toBe(positions.first);
});
