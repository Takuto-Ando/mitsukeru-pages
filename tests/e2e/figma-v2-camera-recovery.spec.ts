import { expect, test, type Page } from "./fixtures";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function mockCamera(page: Page, error: string) {
  await page.addInitScript((initialError) => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    const camera = {
      requests: [] as MediaStreamConstraints[],
      error: initialError,
      pictures: 0,
      stops: 0,
    };
    Object.assign(window, { testCamera: camera });
    const permission = Object.assign(new EventTarget(), {
      state: initialError === "NotAllowedError" ? "denied" : "granted",
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: async () => permission },
    });
    window.addEventListener("test:grant-camera", () => {
      camera.error = "";
      permission.state = "granted";
      permission.dispatchEvent(new Event("change"));
    });
    window.addEventListener("test:release-camera", () => {
      camera.error = "";
      window.dispatchEvent(new Event("focus"));
    });
    const track = Object.assign(new EventTarget(), {
      stop() {
        camera.stops++;
      },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          camera.requests.push(constraints);
          const hasConstraints = typeof constraints.video === "object";
          if (
            camera.error &&
            (camera.error !== "OverconstrainedError" || hasConstraints)
          )
            throw new DOMException("Cannot open camera", camera.error);
          return { getTracks: () => [track], getVideoTracks: () => [track] };
        },
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      srcObject: { configurable: true, set() {} },
      videoWidth: { configurable: true, get: () => 640 },
      videoHeight: { configurable: true, get: () => 480 },
      play: { configurable: true, value: () => Promise.resolve() },
    });
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      ...args: Parameters<typeof drawImage>
    ) {
      if (args[0] instanceof HTMLVideoElement) {
        camera.pictures++;
        this.fillRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      return drawImage.apply(this, args);
    };
  }, error);
}

async function openCamera(page: Page) {
  await page.goto("./");
  await button(page, "つづきから").click();
  await expect(
    page.getByRole("heading", { name: "動物を撮影しよう" }),
  ).toBeAttached();
}

for (const scenario of [
  ["許可を戻した", "NotAllowedError", "test:grant-camera"],
  ["他のアプリがカメラを解放した", "NotReadableError", "test:release-camera"],
] as const) {
  test(`${scenario[0]}とき撮影に復帰する`, async ({ page }) => {
    await mockCamera(page, scenario[1]);
    await openCamera(page);
    await expect(
      page.getByText("シャッターで動物を選べます。", { exact: false }),
    ).toBeVisible();
    await page.evaluate(
      (event) => window.dispatchEvent(new Event(event)),
      scenario[2],
    );
    await expect(page.locator(".camera-fallback")).toHaveCount(0);
    await button(page, "シャッター").click();
    await expect(page.locator(".captured-preview")).toBeVisible();
  });
}

test("背面カメラ向けの条件が使えなくても撮影できる", async ({ page }) => {
  await mockCamera(page, "OverconstrainedError");
  await openCamera(page);
  await button(page, "シャッター").click();
  await expect(page.locator(".captured-preview")).toBeVisible();
});

test("同じ処理内でシャッターを連打しても1枚だけ撮影する", async ({ page }) => {
  await mockCamera(page, "");
  await openCamera(page);
  const shutter = button(page, "シャッター");
  await expect(shutter).toBeEnabled();
  await shutter.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(page.locator(".captured-preview")).toBeVisible();
  const captured = await page.evaluate(
    () =>
      (window as unknown as { testCamera: { pictures: number } }).testCamera
        .pictures,
  );
  expect(captured).toBe(1);
});

for (const [condition, error] of [
  ["カメラなし", "NotFoundError"],
  ["HTTPSではない環境", "insecure"],
] as const) {
  test(`${condition}でも止まらず動物を選べる`, async ({ page }) => {
    await mockCamera(page, error);
    if (error === "insecure") {
      await page.addInitScript(() =>
        Object.defineProperty(window, "isSecureContext", { value: false }),
      );
    }
    await openCamera(page);
    await expect(
      page.getByText("シャッターで動物を選べます。", { exact: false }),
    ).toBeVisible();
    await button(page, "シャッター").click();
    await button(page, "修正").click();
    await expect(button(page, "キリン")).toBeVisible();
  });
}

test("ページを離れるとカメラを止め、戻ると開き直す", async ({ page }) => {
  await mockCamera(page, "");
  await openCamera(page);
  const shutter = button(page, "シャッター");
  await expect(shutter).toBeEnabled();
  const state = () =>
    page.evaluate(() => {
      const { requests, stops } = (
        window as unknown as {
          testCamera: { requests: unknown[]; stops: number };
        }
      ).testCamera;
      return { requests: requests.length, stops };
    });
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await expect(shutter).toBeDisabled();
  expect(await state()).toEqual({ requests: 1, stops: 1 });
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow")),
  );
  await expect(shutter).toBeEnabled();
  expect(await state()).toEqual({ requests: 2, stops: 1 });
});
