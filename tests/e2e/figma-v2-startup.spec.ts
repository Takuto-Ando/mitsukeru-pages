import { expect, test } from "./fixtures";

test.use({ serviceWorkers: "block" });

for (const available of [true, false]) {
  test(`初回の文字は${available ? "秀英丸ゴBの準備後" : "配信失敗後は代替書体"}の一度で表示する`, async ({
    page,
  }) => {
    const kitId = process.env.VITE_ADOBE_FONTS_KIT_ID;
    test.skip(!kitId, "Adobe Fonts の配信設定を入れたビルドで確認");
    let release!: () => void;
    const resumeFontRequest = new Promise<void>(
      (resolve) => (release = resolve),
    );
    await page.route(`https://use.typekit.net/${kitId}.js`, async (route) => {
      await resumeFontRequest;
      if (!available) return route.abort();
      return route.fulfill({
        contentType: "text/javascript",
        body: 'window.Typekit = { load: ({ fontactive }) => fontactive("dnp-shuei-mgothic-std", "n6") };',
      });
    });
    try {
      await page.goto("./", { waitUntil: "domcontentloaded" });
      const logo = page.getByRole("img", { name: "ズーケッチ", exact: true });
      const label = page.locator(".design3-title-tagline");
      await expect(page.locator("html")).toHaveAttribute(
        "data-ui-font",
        "loading",
      );
      await expect(logo).toBeVisible();
      await expect(label).toBeAttached();
      await expect(label).toBeHidden();
      release();
      await expect(label).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-ui-font",
        available ? "dnp" : "fallback",
      );
      await expect(label).toHaveCSS(
        "font-family",
        available ? /^dnp-shuei-mgothic-std/ : /^"?Zen Maru Gothic/,
      );
    } finally {
      release();
    }
  });
}

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
    const start = page.getByRole("button", { name: "つづきから", exact: true });
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
