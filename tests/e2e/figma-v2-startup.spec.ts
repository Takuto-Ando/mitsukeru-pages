import { expect, test } from "./fixtures";

test.use({ serviceWorkers: "block" });

test("最初はタイトルのモジュールだけを読み込み、撮影の読込中もタイトルを表示する", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_PREVIEW !== "1",
    "画面チャンクの分割は公開用ビルドで確認",
  );
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
    if (navigator.serviceWorker)
      Object.defineProperty(navigator.serviceWorker, "register", {
        value: () => Promise.reject(new Error("Disabled for chunk routing")),
      });
  });
  let releaseCamera!: () => void;
  const waitForCamera = new Promise<void>((resolve) => {
    releaseCamera = resolve;
  });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const deferred =
    /\/assets\/(?:ReplicaCamera|ReplicaGallery|ReplicaDrawingScreens|SketchCanvas|SettingsDialog|DrawScreen)-|\/models\/|\.wasm(?:\?|$)/;
  await page.route(/\/assets\/ReplicaCamera-[^/]+\.js$/, async (route) => {
    await waitForCamera;
    await route.continue();
  });
  try {
    await page.goto("./");
    const start = page.getByRole("button", { name: "はじめから", exact: true });
    await expect(start).toBeVisible();
    expect(requests.filter((request) => deferred.test(request))).toEqual([]);

    await start.click();
    await expect
      .poll(() =>
        requests.some((request) => /\/ReplicaCamera-[^/]+\.js$/.test(request)),
      )
      .toBe(true);
    await expect(start).toBeVisible();
    releaseCamera();
    await expect(
      page.getByRole("button", { name: "シャッター" }),
    ).toBeVisible();
  } finally {
    releaseCamera();
  }
});
