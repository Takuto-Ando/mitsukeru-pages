import { expect, test, type Page } from "./fixtures";

async function savedPhoto(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("zooketch-figma-replica");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{
        photo?: string;
        groupId?: string;
        taskId?: string;
        photoLocation?: string;
        sketch?: string;
      } | null>((resolve, reject) => {
        if (!database.objectStoreNames.contains("gallery")) {
          resolve(null);
          return;
        }
        const request = database
          .transaction("gallery")
          .objectStore("gallery")
          .getAll();
        request.onsuccess = () => resolve(request.result[0] ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

test("撮影直後に端末に保存し、動物の選択を写真の詳細に反映する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v1", "1");
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [track] }),
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      srcObject: { configurable: true, set() {}, get: () => null },
      videoWidth: { configurable: true, get: () => 640 },
      videoHeight: { configurable: true, get: () => 480 },
      play: {
        configurable: true,
        value(this: HTMLVideoElement) {
          this.dispatchEvent(new Event("loadeddata"));
          return Promise.resolve();
        },
      },
    });
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      ...args: Parameters<typeof drawImage>
    ) {
      if (args[0] instanceof HTMLVideoElement) {
        this.fillStyle = "#74bbb0";
        this.fillRect(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
      return drawImage.apply(this, args);
    };
  });
  let uploads = 0;
  await page.route("https://script.google.com/macros/**", (route) => {
    uploads++;
    return route.abort();
  });
  const start = () =>
    page.getByRole("button", { name: "はじめから", exact: true });
  const shutter = page.getByRole("button", { name: "シャッター", exact: true });
  const gallery = page.getByRole("button", { name: "ギャラリー", exact: true });
  const enterCamera = async () => {
    await expect(start().or(gallery).first()).toBeVisible();
    if (await start().isVisible()) await start().click();
  };
  await page.goto("./");
  await enterCamera();
  await shutter.click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真" }),
  ).toBeVisible();
  await expect
    .poll(async () => (await savedPhoto(page))?.photo)
    .toMatch(/^data:image\/jpeg/);

  const choose = async (name: string) => {
    await page.getByRole("button", { name: "修正", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  await choose("キリン");
  await choose("カバ");
  await expect
    .poll(() => savedPhoto(page))
    .toMatchObject({
      groupId: "hippo",
      taskId: "hippo",
      photoLocation: "京都市動物園",
    });
  expect((await savedPhoto(page))?.sketch).toBeUndefined();

  await page
    .getByRole("button", { name: "ピツネに見せる", exact: true })
    .click();
  await expect(page.locator("[data-screen=challenge]")).toBeVisible();
  await expect(page.getByRole("img", { name: /^難易度/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "描きはじめる", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "課題を確認してつぎへ", exact: true })
    .click();
  await expect(page.getByTestId("canvas")).toBeVisible();

  await page.reload();
  await enterCamera();
  await gallery.click();
  await page.getByRole("tab", { name: "写真", exact: true }).click();
  await page
    .getByRole("button", { name: "カバの写真を見る", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "カバの写真", exact: true });
  await expect(detail.getByRole("img", { name: "撮影した写真" })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "カバ" })).toBeVisible();
  await expect(detail.locator("time")).toHaveAttribute("datetime", /^\d{4}-/);
  await expect(detail.getByText("京都市動物園", { exact: true })).toBeVisible();
  await expect(detail.locator(".replica-gallery-photo-fact")).not.toBeEmpty();
  expect(uploads).toBe(0);
});
