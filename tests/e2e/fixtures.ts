import { test as base, type Page } from "@playwright/test";
import photoModel from "../../src/recognition/bioclip-model.json" with { type: "json" };
import { taskById } from "../../src/content/tasks";
export { expect, type Page } from "@playwright/test";

export function giraffeTongueStrokes() {
  const region = taskById.giraffe.scene.regions[0];
  const curve = Array.from({ length: 21 }, (_, index) => {
    const t = index / 20;
    return {
      x: region.x + region.width * (0.2 + 0.6 * t),
      y: region.y + region.height * (0.25 + 0.5 * Math.sin(t * Math.PI)),
    };
  });
  return [curve.slice(0, 3), curve.slice(-3), curve];
}

export async function drawGiraffeTongue(page: Page) {
  const canvas = page.getByTestId("canvas");
  await canvas.waitFor();
  const bounds = (await canvas.boundingBox())!;
  for (const stroke of giraffeTongueStrokes()) {
    for (const [index, { x, y }] of stroke.entries()) {
      await page.mouse.move(
        bounds.x + x * bounds.width,
        bounds.y + y * bounds.height,
      );
      if (!index) await page.mouse.down();
    }
    await page.mouse.up();
  }
}

export async function mockTutorialModels(
  page: Page,
  { photo = true, detector = true } = {},
) {
  if (photo)
    await page.route(photoModel.url, (route) =>
      route.fulfill({
        body: "mock model asset",
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
    );
  if (detector)
    await page.route("**/models/yolox*.onnx", (route) =>
      route.fulfill({ body: Buffer.alloc(3_659_407) }),
    );
}

export const test = base.extend<{
  testLiveModel: boolean;
  isolateModels: void;
}>({
  testLiveModel: [false, { option: true }],
  isolateModels: [
    async ({ context, testLiveModel }, use) => {
      // Each test gets a fresh storage partition. Never download the 87 MB
      // remote model in every test, or the local detector outside its own tests.
      await context.route(photoModel.url, (route) => route.abort());
      if (!testLiveModel)
        await context.route("**/models/*.onnx", (route) => route.abort());
      // Public smoke runs must never add test sketches to the research Drive.
      await context.route("**/__zooketch-share", (route) => {
        const origin = route.request().headers().origin;
        return route.fulfill({
          status: 204,
          headers: origin ? { "Access-Control-Allow-Origin": origin } : {},
        });
      });
      await use();
    },
    { auto: true },
  ],
});
