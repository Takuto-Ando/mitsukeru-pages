import { devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { taskById } from "../../src/content/tasks";
import { expect, test, type Page } from "./fixtures";

const sample =
  "data:image/png;base64," +
  readFileSync("public/replica-assets/giraffe-example.png").toString("base64");

test.use({ serviceWorkers: "block", testLiveModel: true });

function action(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

async function useStillCamera(page: Page) {
  await page.addInitScript((photo) => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = () => Promise.reject();
    }
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    const image = new Image();
    image.src = photo;
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          await image.decode();
          return { getTracks: () => [track], getVideoTracks: () => [track] };
        },
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      srcObject: { configurable: true, set() {}, get: () => null },
      videoWidth: { configurable: true, get: () => image.naturalWidth },
      videoHeight: { configurable: true, get: () => image.naturalHeight },
      play: { configurable: true, value: () => Promise.resolve() },
    });
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      ...args: Parameters<typeof draw>
    ) {
      if (args[0] instanceof HTMLVideoElement) args[0] = image;
      return draw.apply(this, args);
    };
  }, sample);
}

async function drawTongue(page: Page) {
  await action(page, "ピツネに見せる").tap();
  await action(page, "スケッチの準備を確認してつぎへ").tap();
  await action(page, "課題を確認してつぎへ").tap();
  const canvas = page.getByTestId("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS("touch-action", "none");

  await canvas.evaluate((element, region) => {
    const rect = element.getBoundingClientRect();
    for (let index = 0; index <= 21; index++) {
      const progress = Math.min(1, index / 20);
      const event =
        index === 0
          ? "pointerdown"
          : index === 21
            ? "pointerup"
            : "pointermove";
      element.dispatchEvent(
        new PointerEvent(event, {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          clientX:
            rect.left +
            rect.width * (region.x + region.width * (0.2 + 0.6 * progress)),
          clientY:
            rect.top +
            rect.height *
              (region.y +
                region.height * (0.25 + Math.sin(progress * Math.PI) * 0.5)),
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }, taskById.giraffe.scene.regions[0]);
  await action(page, "できた！").tap();
  await expect(page.locator(".design3-result")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(widths[0]).toBe(widths[1]);
}

for (const device of ["iPhone SE", "Galaxy S9+"] as const) {
  const { defaultBrowserType, ...profile } = devices[device];
  test.describe(device, () => {
    test.use(profile);
    test("撮影・認識・タッチ描画・保存を小さい画面で通せる", async ({
      browserName,
      page,
    }) => {
      test.skip(
        browserName !== defaultBrowserType,
        "対応するブラウザの組み合わせのみ",
      );
      await useStillCamera(page);
      await page.goto("./");
      await expectNoHorizontalOverflow(page);
      await action(page, "つづきから").tap();
      await expect(page.locator(".replica-camera-tracking")).toBeVisible({
        timeout: 30_000,
      });
      await expectNoHorizontalOverflow(page);
      await action(page, "シャッター").tap();
      await expect(
        page.getByRole("heading", { name: "キリン", exact: true }),
      ).toBeVisible();
      await drawTongue(page);
      await expectNoHorizontalOverflow(page);
      await action(page, "写真を撮る").tap();
      await action(page, "ギャラリー").tap();
      await expect(action(page, "キリンのスケッチを見る")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test.describe("3G相当", () => {
  const { defaultBrowserType: _, ...profile } = devices["Galaxy S9+"];
  test.use(profile);

  test("低速で起動し、実YOLOXの取得を再試行して、タイムアウトした送信をやり直す", async ({
    browserName,
    context,
    page,
  }) => {
    const target = new URL(test.info().project.use.baseURL!);
    test.skip(
      browserName !== "chromium" ||
        process.env.E2E_SLOW_NETWORK !== "1" ||
        process.env.E2E_PREVIEW !== "1" ||
        !["localhost", "127.0.0.1"].includes(target.hostname),
      "3Gはローカル公開用ビルドのChromiumでのみ実行",
    );
    test.setTimeout(180_000);
    await useStillCamera(page);
    await page.addInitScript(() => {
      const fetchNow = window.fetch.bind(window);
      let stalled = false;
      window.fetch = (request, options) => {
        if (!stalled && String(request).endsWith("/__zooketch-share")) {
          stalled = true;
          const payload = JSON.parse(String(options?.body));
          document.documentElement.dataset.stalledShareId = payload.id;
          return new Promise<Response>((_, reject) => {
            options!.signal!.addEventListener(
              "abort",
              () => {
                document.documentElement.dataset.shareTimedOut = "1";
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
        }
        return fetchNow(request, options);
      };
    });

    const modelRequests: string[] = [];
    const modelResponses: string[] = [];
    page.on("response", (response) => {
      if (/yolox|\.wasm/.test(response.url())) {
        modelResponses.push(
          response.status() + " " + new URL(response.url()).pathname,
        );
      }
    });
    page.on("requestfailed", (request) => {
      if (/yolox|\.wasm/.test(request.url())) {
        modelResponses.push(
          request.failure()?.errorText + " " + new URL(request.url()).pathname,
        );
      }
    });
    await page.route("**/models/yolox*.onnx", async (route) => {
      modelRequests.push(route.request().url());
      if (modelRequests.length === 1) await route.fulfill({ status: 503 });
      else await route.continue();
    });
    const sentIds: string[] = [];
    await page.route("**/__zooketch-share", async (route) => {
      sentIds.push(route.request().postDataJSON().id);
      await route.fulfill({ status: 204 });
    });
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 93_750,
      connectionType: "cellular3g",
    });

    const launch = performance.now();
    await page.goto("./", { waitUntil: "domcontentloaded" });
    await expect(action(page, "はじめから")).toBeVisible({ timeout: 15_000 });
    const titleMs = Math.round(performance.now() - launch);
    expect(modelRequests).toHaveLength(0);
    const cameraOpened = performance.now();
    await action(page, "つづきから").tap();
    await expect(action(page, "シャッター")).toBeEnabled({ timeout: 15_000 });
    await expect
      .poll(() => modelRequests.length, {
        timeout: 20_000,
        message: "一時的な503の後にモデルを再取得する",
      })
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator(".replica-camera-tracking"))
      .toBeVisible({
        timeout: 120_000,
      })
      .catch((error) => {
        throw new Error(`モデルとWASMの応答: ${modelResponses.join(", ")}`, {
          cause: error,
        });
      });
    const trackingMs = Math.round(performance.now() - cameraOpened);
    await action(page, "シャッター").tap();
    await drawTongue(page);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-share-timed-out", "1", {
      timeout: 30_000,
    });
    const id = await html.getAttribute("data-stalled-share-id");
    expect(id).toBeTruthy();
    await expect.poll(() => sentIds, { timeout: 20_000 }).toEqual([id]);
    await test.info().attach("3G timings", {
      body: JSON.stringify({
        titleMs,
        trackingMs,
        modelRequests: modelRequests.length,
      }),
      contentType: "application/json",
    });
  });
});
