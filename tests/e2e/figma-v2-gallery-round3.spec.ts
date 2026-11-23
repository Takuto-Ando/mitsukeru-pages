import { expect, test, type Page } from "./fixtures";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function savedGallery(page: Page, oldPaper = false) {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException(
            "Camera blocked for this test",
            "NotAllowedError",
          );
        },
      },
    });
  });
  await page.goto("./");
  await page.evaluate(async (oldPaper) => {
    const image = new URL("replica-assets/giraffe-example.png", location.href)
      .href;
    const blob = await (await fetch(image)).blob();
    const photo = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const sketchWithPaper = (color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 600;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, 600, 600);
      context.fillStyle = "#115599";
      context.fillRect(170, 175, 50, 75);
      return canvas.toDataURL();
    };
    const sketchImages = oldPaper
      ? ["#faf7ec", "#fffef8"].map(sketchWithPaper)
      : [image];
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("zooketch-figma-replica", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("gallery", { keyPath: "id" });
        db.createObjectStore("shareOutbox", { keyPath: "id" }).createIndex(
          "queueState",
          ["queue", "state"],
        );
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("gallery", "readwrite");
        const store = transaction.objectStore("gallery");
        for (let i = 0; i < 14; i++) {
          store.put({
            id: `gallery-round3-${i}`,
            createdAt: new Date(Date.UTC(2026, 10, 20, i)).toISOString(),
            photo,
            sketch: sketchImages[i % sketchImages.length],
            groupId: "giraffe",
            taskId: "giraffe",
            animalName: i === 13 ? "アミメキリン" : "キリン",
            strokes: [
              [
                { x: 335, y: 299 },
                { x: 418, y: 346 },
                { x: 506, y: 314 },
              ],
            ],
            strokeStyles: [{ color: "#115599", width: 9 }],
          });
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, oldPaper);
  await button(page, "つづきから").click();
  await button(page, "ギャラリー").click();
  await expect(
    page.getByRole("button", { name: /キリンのスケッチを見る/ }),
  ).toHaveCount(14);
}

test("ギャラリーのタブとマイページを固定し、写真とスケッチの枠を揃える", async ({
  page,
}) => {
  await savedGallery(page);
  const header = page.locator(".replica-gallery .gallery-header");
  await expect(header).toHaveCSS("height", "84px");
  const headerBounds = (await header.boundingBox())!;
  const heading = (await header.getByRole("heading").boundingBox())!;
  const settings = header.getByRole("button", { name: "マイページ" });
  await expect(settings.locator("span")).toHaveCSS("height", "29px");
  expect(heading.y + heading.height / 2).toBeCloseTo(
    headerBounds.y + headerBounds.height / 2,
    0,
  );
  const tabs = page.getByRole("tablist");
  const tabTop = (await tabs.boundingBox())!.y;
  const panel = page.getByRole("tabpanel");
  const firstSketch = panel.locator(".collection-card").first();
  const sketchSize = (await firstSketch.boundingBox())!;
  const initialRole = await firstSketch.getAttribute("data-record-id");

  await panel.evaluate((element) => {
    element.scrollTop = 280;
  });
  expect(await panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0,
  );
  expect((await tabs.boundingBox())!.y).toBeCloseTo(tabTop, 0);
  await page.getByRole("tab", { name: "写真", exact: true }).click();
  const firstPhoto = page
    .getByRole("tabpanel")
    .locator(".collection-card")
    .first();
  const photoSize = (await firstPhoto.boundingBox())!;
  expect(await firstPhoto.getAttribute("data-record-id")).toBe(initialRole);
  expect(photoSize.width).toBeCloseTo(sketchSize.width, 0);
  expect(photoSize.height).toBeCloseTo(sketchSize.height, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await button(page, "マイページ").click();
  await expect(page.getByRole("dialog", { name: "マイページ" })).toBeVisible();
  await button(page, "端末に保存 ON").click();
  await expect(button(page, "端末に保存 OFF")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await button(page, "設定を閉じる").click();
  await expect(button(page, "マイページ")).toBeFocused();
  await button(page, "アミメキリンの写真を見る").click();
  await expect(
    page.getByRole("dialog", { name: "アミメキリンの写真" }),
  ).toBeVisible();
  await expect(button(page, "保存")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await button(page, "体験に戻る").click();
  await expect(button(page, "シャッター")).toBeVisible();
});

test("保存済みスケッチの紙色だけを一覧で白にする", async ({ page }) => {
  await savedGallery(page, true);
  const previews = page
    .getByRole("tabpanel")
    .locator(".collection-card .replica-sketch-image");
  for (const [index, paper] of [
    [0, [255, 254, 248]],
    [1, [250, 247, 236]],
  ] as const) {
    const preview = previews.nth(index);
    const preserved = await preview.evaluate((element) => {
      const view = (element as SVGSVGElement).viewBox.baseVal;
      const area = element.querySelector("clipPath rect")!;
      const center = (axis: "x" | "y", length: "width" | "height") =>
        (Number(area.getAttribute(axis)) +
          Number(area.getAttribute(length)) / 2 -
          view[axis]) /
        view[length];
      return [center("x", "width"), center("y", "height")];
    });
    const screenshot = await preview.screenshot({ animations: "disabled" });
    const colors = await page.evaluate(
      async ({ png, preserved }) => {
        const bitmap = new Image();
        bitmap.src = `data:image/png;base64,${png}`;
        await bitmap.decode();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return [[0.2, 0.15], [0.2, 0.38], preserved].map(([x, y]) =>
          [
            ...context.getImageData(x * canvas.width, y * canvas.height, 1, 1)
              .data,
          ].slice(0, 3),
        );
      },
      { png: screenshot.toString("base64"), preserved },
    );
    expect(colors[0]).toEqual([255, 255, 255]);
    expect(colors[2]).toEqual(paper);
    // WebKit can round colors of rendered SVG filter layers.
    colors[1].forEach((value, channel) =>
      expect(Math.abs(value - [17, 85, 153][channel])).toBeLessThanOrEqual(4),
    );
  }
});

test("同じ記録の写真とスケッチを1回の操作で共有し、非対応環境では保存できる", async ({
  page,
}) => {
  await savedGallery(page);
  await button(page, "アミメキリンのスケッチを見る").click();
  const sketch = page.getByRole("dialog", { name: "アミメキリンのスケッチ" });
  await expect(
    sketch.getByRole("heading", { name: "キリンの舌", exact: true }),
  ).toBeVisible();
  const difficulty = sketch.getByRole("img", { name: "難易度 1 / 3" });
  await expect(difficulty).toHaveCSS("min-height", "32.93px");
  const difficultyBounds = (await difficulty.boundingBox())!;
  expect(difficultyBounds.width).toBeCloseTo(153.06, 1);
  expect(difficultyBounds.height).toBeCloseTo(32.93, 1);
  await expect(sketch.locator(".zoo-card-summary-line").first()).toHaveCSS(
    "font-weight",
    process.env.VITE_ADOBE_FONTS_KIT_ID ? "600" : "700",
  );
  const line = sketch.getByTestId("user-lines").locator('[stroke="#115599"]');
  expect(await line.count()).toBeGreaterThan(0);
  const priorMotion = await sketch
    .getByTestId("giraffe-leaf-bite")
    .elementHandle();
  await sketch
    .getByRole("button", { name: "スケッチの動きをもう一度見る" })
    .click();
  await expect(sketch.getByTestId("giraffe-leaf-bite")).toBeAttached();
  expect(await priorMotion!.evaluate((element) => element.isConnected)).toBe(
    false,
  );
  const sketchSize = (await sketch.locator(".comparison-stage").boundingBox())!;
  const closePosition = (detail: typeof sketch) =>
    detail.getByRole("button", { name: "一覧に戻る" }).boundingBox();
  const save = (detail: typeof sketch) =>
    detail.getByRole("button", { name: "保存", exact: true });
  async function checkDetailControls(
    detail: typeof sketch,
    cardSelector: string,
    switchWidth: number,
    closeInset: number,
    cardGap: number,
  ) {
    const card = (await detail.locator(cardSelector).boundingBox())!;
    const switchLabel = detail.locator(".gallery-card-switch-label");
    const label = (await switchLabel.boundingBox())!;
    const close = detail.getByRole("button", { name: "一覧に戻る" });
    const closeGlyph = (await close.locator(".gallery-mark").boundingBox())!;
    expect(label.width).toBeCloseTo(switchWidth, 0);
    expect(label.height).toBeCloseTo(36, 0);
    expect(card.y - label.y - label.height).toBeCloseTo(cardGap, 0);
    expect(card.x + card.width - label.x - label.width).toBeCloseTo(52, 0);
    expect(closeGlyph.x - card.x).toBeCloseTo(closeInset, 0);
    expect(closeGlyph.width).toBeCloseTo(36, 0);
    await expect(save(detail).locator("svg")).toHaveCSS("width", "34px");
    const controls = [
      close,
      detail.locator(".gallery-card-switch"),
      save(detail),
    ];
    const bounds = await Promise.all(
      controls.map((control) => control.boundingBox()),
    );
    for (const box of bounds) {
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    expect(bounds[0]!.x + bounds[0]!.width).toBeLessThanOrEqual(bounds[1]!.x);
    expect(bounds[1]!.x + bounds[1]!.width).toBeLessThanOrEqual(bounds[2]!.x);
  }
  await checkDetailControls(sketch, ".sketch-result-card", 138, 0, 14);
  const initialClosePosition = await closePosition(sketch);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => data.files?.length === 1,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        document.documentElement.dataset.galleryNativeShare = [
          file?.name,
          file?.type,
          navigator.userActivation?.isActive ?? "unavailable",
        ].join("|");
      },
    });
  });
  await save(sketch).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-gallery-native-share",
    /^ズーケッチ-アミメキリン-スケッチ\.png\|image\/png\|(true|unavailable)$/,
  );

  await sketch.getByRole("button", { name: "写真を見る", exact: true }).click();
  const photo = page.getByRole("dialog", { name: "アミメキリンの写真" });
  await checkDetailControls(photo, ".replica-gallery-photo-card", 156, 0, 23);
  expect(await closePosition(photo)).toEqual(initialClosePosition);
  await expect(photo.locator(".zoo-card-summary-line").first()).toHaveCSS(
    "font-weight",
    process.env.VITE_ADOBE_FONTS_KIT_ID ? "600" : "700",
  );
  const photoSize = (await photo
    .locator(".replica-gallery-photo-preview")
    .boundingBox())!;
  expect(photoSize.width).toBeCloseTo(sketchSize.width, 0);
  expect(photoSize.height).toBeCloseTo(sketchSize.height, 0);
  await save(photo).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-gallery-native-share",
    /^zooketch-photo-2026-11-20\.png\|image\/png\|(true|unavailable)$/,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { value: () => false });
  });
  const [original] = await Promise.all([
    page.waitForEvent("download"),
    save(photo).click(),
  ]);
  expect(original.suggestedFilename()).toBe("zooketch-photo-2026-11-20.png");
  await page.setViewportSize({ width: 320, height: 568 });
  await checkDetailControls(photo, ".replica-gallery-photo-card", 156, 0, 23);
  const narrowClosePosition = await closePosition(photo);
  await photo
    .getByRole("button", { name: "スケッチを見る", exact: true })
    .click();
  await expect(sketch.getByTestId("giraffe-leaf-bite")).toBeAttached();
  await checkDetailControls(sketch, ".sketch-result-card", 138, 0, 14);
  expect(await closePosition(sketch)).toEqual(narrowClosePosition);
  await sketch.getByRole("button", { name: "一覧に戻る" }).click();
  await expect(sketch).toBeHidden();
});
