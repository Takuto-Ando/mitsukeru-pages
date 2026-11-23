import { test as base } from "@playwright/test";
import photoModel from "../../src/recognition/bioclip-model.json" with { type: "json" };
export { expect, type Page } from "@playwright/test";

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
