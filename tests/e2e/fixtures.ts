import { test as base, type Page } from "@playwright/test";
import photoModel from "../../src/recognition/bioclip-model.json" with { type: "json" };
export { expect, type Page } from "@playwright/test";

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
