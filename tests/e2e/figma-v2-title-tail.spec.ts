import { expect, test } from "./fixtures";

test.use({ reducedMotion: "no-preference" });

test("トップの尻尾は画像の読み込み中や画面の回転でも元の比率と大きさを保つ", async ({
  page,
}) => {
  let releaseImage!: () => void;
  const imageReady = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route("**/figma/entry/tail.svg", async (route) => {
    await imageReady;
    await route.continue();
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });
  const tail = page.locator(".design3-title-tail");
  await expect(tail).toBeVisible();
  const size = () =>
    tail.evaluate((image: HTMLImageElement) => {
      const style = getComputedStyle(image);
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);
      const title = image.closest(".design3-title")!;
      const titleStyle = getComputedStyle(title);
      const titleContentWidth =
        title.clientWidth -
        parseFloat(titleStyle.paddingLeft) -
        parseFloat(titleStyle.paddingRight);
      return {
        width,
        height,
        expectedWidth: Math.min(
          titleContentWidth * 0.97,
          363,
          101 + innerHeight * 0.4,
        ),
      };
    });

  const beforeLoad = await size();
  releaseImage();
  await tail.evaluate((image: HTMLImageElement) => image.decode());
  const afterLoad = await size();
  expect(beforeLoad.width).toBeCloseTo(afterLoad.width, 1);
  expect(beforeLoad.height).toBeCloseTo(afterLoad.height, 1);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 920 },
  ]) {
    await page.setViewportSize(viewport);
    const { width, height, expectedWidth } = await size();
    expect(Math.abs(width - expectedWidth)).toBeLessThan(1);
    expect(height / width).toBeCloseTo(365.978 / 362.806, 2);
    expect(width).toBeLessThanOrEqual(363);
    expect(height).toBeLessThanOrEqual(366);
  }

  const motionSamples = await tail.evaluate((image) => {
    const sway = image
      .getAnimations()
      .find(
        (animation) =>
          (animation as CSSAnimation).animationName === "title-tail-sway",
      )!;
    sway.pause();
    return [0, 1540, 2992].map((time) => {
      sway.currentTime = time;
      const transform = new DOMMatrix(getComputedStyle(image).transform);
      return {
        scale: Math.hypot(transform.a, transform.b),
        angle: Math.atan2(transform.b, transform.a),
      };
    });
  });
  for (const { scale } of motionSamples) expect(scale).toBeCloseTo(1, 4);
  expect(motionSamples[0].angle).not.toBeCloseTo(motionSamples[1].angle, 2);
  expect(motionSamples[0].angle).not.toBeCloseTo(motionSamples[2].angle, 2);
});
