import { expect, test } from "./fixtures";
import { taskById } from "../../src/content/tasks";

test.use({ reducedMotion: "no-preference" });

test("通常スケッチはズームと消しゴムの説明を省き、キリンは描いた舌で葉を取る", async ({
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
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await page.goto("./");
  await button("はじめから").click();
  await button("シャッター").click();
  await button("修正").click();
  await button("キリン").click();
  await button("ピツネに見せる").click();

  const canvas = page.getByTestId("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("group", { name: "拡大・縮小" })).toHaveCount(0);
  await button("消しゴム").click();
  await expect(button("消しゴム")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/なぞった部分だけ消えるよ/)).toHaveCount(0);
  await button("ペン").click();

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

  const effect = page.getByTestId("giraffe-leaf-bite");
  const leaf = effect.locator(".giraffe-result-leaf");
  await expect(effect).toBeVisible();
  await expect(leaf).toHaveAttribute("href", /giraffe-result-leaf\.svg$/);
  await expect(
    effect.locator(".giraffe-result-branch image").first(),
  ).toHaveAttribute("href", /giraffe-result-branch\.svg$/);
  const drawing = page.getByTestId("user-lines").locator("polyline").first();
  await expect(drawing).toBeVisible();
  const points = await drawing.getAttribute("points");
  const tongue = effect.locator(".giraffe-result-tongue");
  const reachedLeaf = await tongue.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.currentTime = 1_000;
    const transform = getComputedStyle(element).transform;
    return transform !== "none" && !new DOMMatrix(transform).isIdentity;
  });
  expect(reachedLeaf).toBe(true);
  await expect(leaf).toHaveCSS("opacity", "0");
  await expect
    .poll(() =>
      tongue.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none" || new DOMMatrix(transform).isIdentity;
      }),
    )
    .toBe(true);
  await expect(drawing).toHaveAttribute("points", points!);
});
