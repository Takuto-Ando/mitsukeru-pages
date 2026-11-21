import { expect, test } from "./fixtures";
import { taskById } from "../../src/content/tasks";

test.use({ reducedMotion: "no-preference" });

test("通常スケッチはズームと消しゴムの説明を省き、キリンは描いた舌を伸ばして葉を2枚取る", async ({
  page,
}) => {
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

  const canvas = page.getByTestId("canvas");
  await expect(canvas).toBeVisible();
  const speech = page.locator(".mission-pitsune-row .bubble-line-text");
  await expect(speech).toHaveText("舌をよく観察してみて！");
  await expect(speech).toBeVisible();
  await expect(page.getByRole("group", { name: "拡大・縮小" })).toHaveCount(0);
  await button("消しゴム").click();
  await expect(button("消しゴム")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/なぞった部分だけ消えるよ/)).toHaveCount(0);
  await button("ペン").click();

  const bounds = (await canvas.boundingBox())!;
  const scene = taskById.giraffe.scene;
  const region = scene.regions[0];
  const drawingHeight = scene.frameHeight || 400;
  const foreground = page.locator(".drawing-foreground");
  await expect(foreground.locator("image")).toHaveAttribute(
    "href",
    /giraffe\.svg$/,
  );
  await expect(foreground.locator("mask")).toHaveCount(0);
  await button("ヒントを見る").click();
  await expect(speech).toHaveText("もうすこし観察してみて！");
  const target = page.getByTestId("drawing-target");
  await expect(target).toBeVisible();
  const layers = await target.evaluate((hint) => {
    const stage = hint.closest(".scene-stage")!;
    return ["svg.eye-template", "canvas", ".drawing-foreground"].map(
      (selector) =>
        Number(getComputedStyle(stage.querySelector(selector)!).zIndex) || 0,
    );
  });
  expect(layers[0]).toBeLessThan(layers[1]);
  expect(layers[1]).toBeLessThan(layers[2]);

  // Paint in the white space above the tongue target, then keep drawing the tongue.
  const position = (x: number, y: number) =>
    [
      bounds.x + (bounds.width * x) / 600,
      bounds.y + (bounds.height * y) / drawingHeight,
    ] as const;
  const [bodyX, bodyY] = position(170, 395);
  const bodyClip = {
    x: Math.round(bodyX) - 2,
    y: Math.round(bodyY) - 2,
    width: 4,
    height: 4,
  };
  const bodyPixels = async () => {
    const png = await page.screenshot({ clip: bodyClip });
    return page.evaluate(async (base64) => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const sample = document.createElement("canvas");
      sample.width = image.naturalWidth;
      sample.height = image.naturalHeight;
      const context = sample.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return Array.from(
        context.getImageData(0, 0, sample.width, sample.height).data,
      );
    }, png.toString("base64"));
  };
  await page.mouse.move(...position(155, 395));
  await page.mouse.down();
  await page.mouse.move(...position(185, 395), { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() =>
      canvas.evaluate((surface, height) => {
        const element = surface as HTMLCanvasElement;
        return element
          .getContext("2d")!
          .getImageData(
            Math.round((element.width * 170) / 600),
            Math.round((element.height * 395) / height),
            1,
            1,
          ).data[3];
      }, drawingHeight),
    )
    .toBeGreaterThan(0);
  await page.mouse.move(2, 2);
  const setCanvasVisibility = (value: string) =>
    canvas.evaluate((element, visibility) => {
      (element as HTMLCanvasElement).style.visibility = visibility;
    }, value);
  const visibleWithInk = await bodyPixels();
  await setCanvasVisibility("hidden");
  const visibleWithoutInk = await bodyPixels();
  await setCanvasVisibility("");
  // Minor RGB rounding can change when WebKit composites the canvas; the
  // purple stroke would change the blue channel by more than 50 here.
  expect(
    Math.max(
      ...visibleWithInk.map((value, i) =>
        Math.abs(value - visibleWithoutInk[i]),
      ),
    ),
  ).toBeLessThanOrEqual(7);
  await button("ひとつ戻す").click();

  await page.mouse.move(...position(480, 140));
  await page.mouse.down();
  await page.mouse.move(...position(520, 144), { steps: 8 });
  await page.mouse.up();
  await expect(button("できた！")).toBeEnabled();
  await expect
    .poll(() =>
      canvas.evaluate((element, height) => {
        const surface = element as HTMLCanvasElement;
        return surface
          .getContext("2d")!
          .getImageData(
            Math.round((surface.width * 500) / 600),
            Math.round((surface.height * 142) / height),
            1,
            1,
          ).data[3];
      }, drawingHeight),
    )
    .toBeGreaterThan(0);
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
  const firstLeaf = effect.locator(".giraffe-result-leaf").nth(0);
  const secondLeaf = effect.locator(".giraffe-result-leaf").nth(1);
  await expect(effect).toBeVisible();
  await expect(
    page.getByTestId("untargeted-lines").locator("polyline"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const open = indexedDB.open("zooketch-figma-replica", 1);
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        const records = await new Promise<{ sketch?: string }[]>(
          (resolve, reject) => {
            const query = database
              .transaction("gallery")
              .objectStore("gallery")
              .getAll();
            query.onsuccess = () => resolve(query.result);
            query.onerror = () => reject(query.error);
          },
        );
        database.close();
        const sketch = records.find((record) => record.sketch)?.sketch;
        if (!sketch) return null;
        const image = new Image();
        image.src = sketch;
        await image.decode();
        const preview = document.createElement("canvas");
        preview.width = image.width;
        preview.height = image.height;
        const context = preview.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return Array.from(context.getImageData(1000, 284, 1, 1).data);
      }),
    )
    .toEqual([107, 92, 122, 255]);
  await expect(firstLeaf).toHaveAttribute("href", /giraffe-result-leaf\.svg$/);
  await expect(secondLeaf).toHaveAttribute(
    "href",
    /giraffe-result-leaf-2\.svg$/,
  );
  await expect(
    effect.locator(".giraffe-result-branch image").first(),
  ).toHaveAttribute("href", /giraffe-result-branch\.svg$/);
  const drawing = page.getByTestId("user-lines").locator("polyline").first();
  await expect(drawing).toBeVisible();
  const points = await drawing.getAttribute("points");
  const tongue = effect.locator(".giraffe-result-tongue");
  await expect(effect.locator("path")).toHaveCount(0);
  const seek = (time: number) =>
    effect.evaluate(async (element, milliseconds) => {
      const animations = element.getAnimations({ subtree: true });
      for (const animation of animations) animation.pause();
      await Promise.all(animations.map((animation) => animation.ready));
      for (const animation of animations) animation.currentTime = milliseconds;
    }, time);
  await seek(970);
  await expect(firstLeaf).toHaveCSS("opacity", "1");
  await expect(secondLeaf).toHaveCSS("opacity", "1");
  const reachingFirst = await tongue.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(reachingFirst).not.toBe("none");
  await seek(1300);
  await expect(firstLeaf).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await seek(2770);
  await expect(firstLeaf).toHaveCSS("opacity", "0");
  await expect(secondLeaf).toHaveCSS("opacity", "1");
  const reachingSecond = await tongue.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(reachingSecond).not.toBe(reachingFirst);
  await seek(3600);
  await expect(secondLeaf).toHaveCSS("opacity", "0");
  await expect(tongue).toHaveCSS("transform", "none");
  await expect(drawing).toHaveAttribute("points", points!);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(firstLeaf).toHaveCSS("opacity", "1");
  await expect(secondLeaf).toHaveCSS("opacity", "1");
  await expect(tongue).toHaveCSS("transform", "none");
  await expect(drawing).toHaveAttribute("points", points!);
});
