import { expect, test, type Page } from "./fixtures";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function savedGallery(page: Page) {
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
  await page.evaluate(async () => {
    const image = new URL("replica-assets/giraffe-example.png", location.href)
      .href;
    const blob = await (await fetch(image)).blob();
    const photo = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
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
            sketch: image,
            groupId: "giraffe",
            taskId: "giraffe",
            animalName: "キリン",
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
  });
  await button(page, "はじめから").click();
  await button(page, "ギャラリー").click();
  await expect(button(page, "キリンのスケッチを見る")).toHaveCount(14);
}

test("ギャラリーのタブとマイページを固定し、写真とスケッチの枠を揃える", async ({
  page,
}) => {
  await savedGallery(page);
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
  await button(page, "設定を閉じる").click();
  await expect(button(page, "マイページ")).toBeFocused();
  await button(page, "体験に戻る").click();
  await expect(button(page, "シャッター")).toBeVisible();
});

test("同じ記録の写真カードとスケッチに切り替え、線の動きを再生してカードを保存する", async ({
  page,
}) => {
  await savedGallery(page);
  await button(page, "キリンのスケッチを見る").first().click();
  const sketch = page.getByRole("dialog", { name: "キリンのスケッチ" });
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

  await sketch.getByRole("button", { name: "写真を見る", exact: true }).click();
  const photo = page.getByRole("dialog", { name: "キリンの写真" });
  const photoSize = (await photo
    .locator(".replica-gallery-photo-preview")
    .boundingBox())!;
  expect(photoSize.width).toBeCloseTo(sketchSize.width, 0);
  expect(photoSize.height).toBeCloseTo(sketchSize.height, 0);
  const share = photo.getByRole("button", { name: "共有", exact: true });
  await share.click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    photo.getByRole("button", { name: "カードを保存", exact: true }).click(),
  ]);
  expect(download.suggestedFilename().normalize("NFC")).toBe(
    "ズーケッチ-キリン-写真.png",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
  });
  await share.click();
  const [original] = await Promise.all([
    page.waitForEvent("download"),
    photo
      .getByRole("button", { name: "写真を端末に保存", exact: true })
      .click(),
  ]);
  expect(original.suggestedFilename()).toBe("zooketch-photo-2026-11-20.png");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      value: (data: ShareData) => data.files?.length === 1,
    });
    Object.defineProperty(navigator, "share", {
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
  await share.click();
  await photo
    .getByRole("button", { name: "写真を端末に保存", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-gallery-native-share",
    /^zooketch-photo-2026-11-20\.png\|image\/png\|(true|unavailable)$/,
  );
  await photo
    .getByRole("button", { name: "スケッチを見る", exact: true })
    .click();
  await expect(sketch.getByTestId("giraffe-leaf-bite")).toBeAttached();
});
