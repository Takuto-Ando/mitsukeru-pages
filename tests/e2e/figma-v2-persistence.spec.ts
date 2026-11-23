import { taskById } from "../../src/content/tasks";
import { expect, test, type Page } from "./fixtures";

const relayUrl = (base: string) =>
  new URL(
    new URL(base).origin === "https://takuto-ando.github.io"
      ? "https://zooketch.pages.dev/__zooketch-share"
      : "__zooketch-share",
    base,
  ).href;
const developmentRelay =
  "https://script.google.com/macros/s/zooketch-test/exec";
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function openDrawing(page: Page) {
  await page.goto("./");
  await button(page, "つづきから").click();
  await button(page, "シャッター").click();
  await button(page, "修正").click();
  await button(page, "キリン").click();
  await button(page, "描いてもらう").click();
  await button(page, "スケッチの準備を確認してつぎへ").click();
  await button(page, "課題を確認してつぎへ").click();
  const canvas = page.getByTestId("canvas");
  // The first sketch screen waits for its separate production bundle.
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const bounds = (await canvas.boundingBox())!;
  const region = taskById.giraffe.scene.regions[0];
  for (let index = 0; index <= 20; index++) {
    const t = index / 20;
    await page.mouse.move(
      bounds.x + (region.x + region.width * (0.2 + 0.6 * t)) * bounds.width,
      bounds.y +
        (region.y + region.height * (0.25 + Math.sin(t * Math.PI) * 0.5)) *
          bounds.height,
    );
    if (!index) await page.mouse.down();
  }
  await page.mouse.up();
}

async function storedSketchRows(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("zooketch-figma-replica");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise<{ id: string; strokeCount: number }[]>(
        (resolve, reject) => {
          const request = database
            .transaction("gallery")
            .objectStore("gallery")
            .getAll();
          request.onsuccess = () =>
            resolve(
              request.result
                .filter((row) => row.sketch)
                .map((row) => ({
                  id: row.id,
                  strokeCount: row.strokes?.length ?? 0,
                })),
            );
          request.onerror = () => reject(request.error);
        },
      );
    } finally {
      database.close();
    }
  });
}

async function storedSketches(page: Page) {
  return (await storedSketchRows(page)).map((row) => row.id);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
});

test("描画中の完了操作で最後の線が失われず、連打してもスケッチは1件だけ保存される", async ({
  page,
}) => {
  await openDrawing(page);
  const done = button(page, "できた！");
  const canvas = page.getByTestId("canvas");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.8,
    bounds.y + bounds.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.85,
    bounds.y + bounds.height * 0.56,
  );
  // Keyboard activation must not interrupt a stroke held by a pointer.
  await done.press("Enter");
  await expect(canvas).toBeVisible();
  await page.mouse.up();
  await expect(done).toBeEnabled();
  await done.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
  await expect(button(page, "写真を撮る")).toBeEnabled();
  await expect
    .poll(async () =>
      (await storedSketchRows(page)).map(({ strokeCount }) => strokeCount),
    )
    .toEqual([2]);
});

test("保存時の容量不足を表示し、空きができたら描いた絵を再試行して保存できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key?) {
      if (
        this.name === "gallery" &&
        value?.sketch &&
        sessionStorage.getItem("test:no-storage") === "1"
      )
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });

  await openDrawing(page);
  await page.evaluate(() => sessionStorage.setItem("test:no-storage", "1"));
  await button(page, "できた！").click();
  await expect(page.getByText(/スケッチを保存できませんでした/)).toBeVisible();
  await expect(button(page, "写真を撮る")).toBeEnabled();
  await expect.poll(() => storedSketches(page)).toHaveLength(0);

  await page.evaluate(() => sessionStorage.removeItem("test:no-storage"));
  await button(page, "写真を撮る").click();
  await expect(button(page, "シャッター")).toBeVisible();
  await expect.poll(() => storedSketches(page)).toHaveLength(1);
});

test("localStorage容量不足と通信断のあと、保存した絵を再読み込み後に同じIDで送る", async ({
  context,
  page,
}) => {
  const base = test.info().project.use.baseURL!;
  const production =
    process.env.E2E_PREVIEW === "1" || base.startsWith("https://");
  const endpoint = production ? relayUrl(base) : developmentRelay;
  // WebKit bypasses Playwright routing for service-worker-controlled pages,
  // even when the worker leaves this POST to the network.
  await context.addInitScript(() => {
    if (navigator.serviceWorker)
      navigator.serviceWorker.register = () => Promise.reject();
  });
  await page.addInitScript(
    ({ production, endpoint }) => {
      if (!production)
        localStorage.setItem(
          "zooketch-share-v1",
          JSON.stringify({ consent: true, endpoint, token: "test" }),
        );
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key.endsWith("share-queue-v1"))
          throw new DOMException(
            "Storage quota exceeded",
            "QuotaExceededError",
          );
        setItem.call(this, key, value);
      };
      Object.defineProperty(navigator, "onLine", {
        get: () => sessionStorage.getItem("test:share-offline") !== "1",
      });
    },
    { production, endpoint },
  );
  const requests: string[] = [];
  await context.route(endpoint, (route) => {
    requests.push(route.request().postDataJSON().id);
    if (requests.length !== 1) return route.fulfill({ status: 204 });
    // A managed relay gives an explicit failure response. The development
    // no-cors endpoint should instead simulate a network rejection.
    return production ? route.fulfill({ status: 503 }) : route.abort("failed");
  });

  await openDrawing(page);
  await page.evaluate(() => sessionStorage.setItem("test:share-offline", "1"));
  await button(page, "できた！").click();
  await expect.poll(() => storedSketches(page)).toHaveLength(1);
  const [id] = await storedSketches(page);
  expect(requests).toEqual([]);

  await page.reload();
  const secondTab = await context.newPage();
  await Promise.all([
    secondTab.goto(new URL("./", base).href),
    page.evaluate(() => {
      sessionStorage.removeItem("test:share-offline");
      window.dispatchEvent(new Event("online"));
    }),
  ]);
  await expect.poll(() => requests, { timeout: 12_000 }).toEqual([id, id]);
  await expect
    .poll(() =>
      page.evaluate(async (recordId) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("zooketch-figma-replica");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<string>((resolve, reject) => {
            const request = db
              .transaction("shareOutbox")
              .objectStore("shareOutbox")
              .get(recordId);
            request.onsuccess = () => resolve(request.result?.state);
            request.onerror = () => reject(request.error);
          });
        } finally {
          db.close();
        }
      }, id),
    )
    .toBe("sent");

  await secondTab.close();
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(button(page, "はじめから")).toBeVisible();
  expect(requests).toEqual([id, id]);
});

test("旧版のギャラリーと未送信キューを更新してもスケッチを読めて送れる", async ({
  page,
}) => {
  await page.route("**/__storage-migration.html", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  );
  await page.goto("./__storage-migration.html");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("zooketch-figma-replica", 1);
      open.onupgradeneeded = () =>
        open.result.createObjectStore("gallery", { keyPath: "id" });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("gallery", "readwrite");
        transaction.objectStore("gallery").put({
          id: "v1-sketch",
          createdAt: "2026-01-01T00:00:00Z",
          sketch: document.createElement("canvas").toDataURL(),
          groupId: "giraffe",
          taskId: "giraffe",
          animalName: "キリン",
        });
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });

  const base = test.info().project.use.baseURL!;
  const production =
    process.env.E2E_PREVIEW === "1" || base.startsWith("https://");
  const endpoint = production ? relayUrl(base) : developmentRelay;
  await page.evaluate(
    ({ endpoint, production }) => {
      if (!production)
        localStorage.setItem(
          "zooketch-share-v1",
          JSON.stringify({ consent: true, endpoint, token: "test" }),
        );
      localStorage.setItem(
        "zooketch-share-queue-v1",
        JSON.stringify({ sent: [], pending: ["v1-sketch"] }),
      );
    },
    { endpoint, production },
  );
  const uploaded: string[] = [];
  await page.route(endpoint, (route) => {
    uploaded.push(route.request().postDataJSON().id);
    return route.fulfill({ status: 204 });
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  await button(page, "ギャラリー").click();
  await expect(button(page, "キリンのスケッチを見る")).toBeVisible();
  expect(await storedSketches(page)).toEqual(["v1-sketch"]);
  await expect.poll(() => uploaded).toEqual(["v1-sketch"]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("zooketch-share-queue-v1") ?? "{}")
            .pending,
      ),
    )
    .toEqual([]);
});

test("IndexedDBにアクセスできない間も撮影画面を開けてギャラリーを再試行できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version?) {
      if (
        name === "zooketch-figma-replica" &&
        sessionStorage.getItem("test:idb-denied") === "1"
      )
        throw new DOMException("IndexedDB disabled", "SecurityError");
      return open.call(this, name, version);
    };
  });
  await page.goto("./");
  await page.evaluate(() => sessionStorage.setItem("test:idb-denied", "1"));
  await button(page, "つづきから").click();
  await expect(button(page, "シャッター")).toBeVisible();
  await button(page, "ギャラリー").click();
  await expect(page.getByText("ギャラリーを開けませんでした。")).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem("test:idb-denied"));
  await button(page, "もう一度試す").click();
  await expect(page.getByText("ギャラリーを開けませんでした。")).toBeHidden();
  await expect(button(page, "写真を撮る")).toBeVisible();
});
