import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { transform, build } from "esbuild";
// Inject only into a disposable test page. No public route or app flag is added.
test("未接続の写真カードをスマートフォン環境で生成できる", async ({ page }) => {
  await page.goto("./");
  const { code } = await transform(
    readFileSync("src/future/photoCard.ts", "utf8"),
    {
      loader: "ts",
      format: "iife",
      globalName: "FuturePhotoCard",
      target: "es2022",
    },
  );
  await page.addScriptTag({ content: code });
  const result = await page.evaluate(async () => {
    const api = (window as any).FuturePhotoCard;
    async function solid(color: string, width: number, height: number) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      return new Promise<Blob>((resolve) =>
        c.toBlob((blob) => resolve(blob!), "image/png"),
      );
    }
    const photo = await solid("#ff0000", 80, 160),
      sketch = await solid("#0000ff", 160, 80);
    const blob = await api.composePhotoCard({
      photo,
      sketch,
      animalName: "ヤギ",
      featureName: "瞳孔",
      discovery: "横長だった。",
    });
    const url = URL.createObjectURL(blob),
      image = new Image();
    image.src = url;
    await image.decode();
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const pixel = (x: number, y: number) => [
      ...ctx.getImageData(x, y, 1, 1).data,
    ];
    URL.revokeObjectURL(url);
    let rejected = false;
    try {
      await api.composePhotoCard({
        photo: new Blob(["broken"], { type: "image/png" }),
        sketch,
        animalName: "ヤギ",
        featureName: "瞳孔",
      });
    } catch {
      rejected = true;
    }
    return {
      type: blob.type,
      width: image.width,
      height: image.height,
      photo: pixel(500, 400),
      sketch: pixel(500, 1000),
      margin: pixel(70, 400),
      rejected,
    };
  });
  expect(result.type).toBe("image/png");
  expect(result.width).toBe(1000);
  expect(result.height).toBeGreaterThan(1370);
  expect(result.photo).toEqual([255, 0, 0, 255]);
  expect(result.sketch).toEqual([0, 0, 255, 255]);
  expect(result.margin).toEqual([250, 247, 236, 255]);
  expect(result.rejected).toBe(true);
});

test("保存状態チェックは独立DBを片付け既存ノートに触れない", async ({
  page,
}) => {
  await page.goto("./");
  const { code } = await transform(
    readFileSync("src/future/storageCheck.ts", "utf8"),
    {
      loader: "ts",
      format: "iife",
      globalName: "FutureStorage",
      target: "es2022",
    },
  );
  await page.addScriptTag({ content: code });
  const result = await page.evaluate(async () => {
    const api = (window as any).FutureStorage;
    const name = "future-test-existing";
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("keep");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keep", "readwrite");
      tx.objectStore("keep").put("untouched", "marker");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const status = await api.inspectStorage();
    const checks = await Promise.all([api.probeStorage(), api.probeStorage()]);
    const marker = await new Promise((resolve) => {
      const r = db.transaction("keep").objectStore("keep").get("marker");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    indexedDB.deleteDatabase(name);
    const leftovers = indexedDB.databases
      ? (await indexedDB.databases()).filter((d) =>
          d.name?.startsWith("zooketch-probe-"),
        )
      : [];
    return { status, checks, marker, leftovers };
  });
  expect(result.status.indexedDBAvailable).toBe(true);
  expect(result.checks).toEqual([
    { writable: true, cleanup: "complete" },
    { writable: true, cleanup: "complete" },
  ]);
  expect(result.marker).toBe("untouched");
  expect(result.leftovers).toEqual([]);
  const unavailable = await page.evaluate(async () => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    });
    return (window as any).FutureStorage.probeStorage();
  });
  expect(unavailable).toEqual({
    writable: false,
    cleanup: "not-needed",
    reason: "unavailable",
  });
});

test("アンケートは同意なしに表示せず、任意回答と失敗後の再試行に対応", async ({
  page,
}) => {
  await page.goto("./");
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
      import { PostUseSurvey } from './src/future/SurveyQuestionnaire';
      const host = document.createElement('div'); host.id = 'future-survey'; document.body.replaceChildren(host);
      const root = createRoot(host); window.testRecords = []; window.testFailures = 1;
      window.showSurvey = consent => root.render(React.createElement(PostUseSurvey, { consent, taskId: 'goat',
        onSave: async (row, signal) => { if (window.holdSave) { window.pendingSignal = signal; await new Promise(resolve => window.releaseSave = resolve); if (signal.aborted) return; } if (window.testFailures-- > 0) throw new Error('test'); window.testRecords.push(row); }, onSkip: () => { window.skipped = true; } }));
      window.showSurvey(false);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.getByRole("form", { name: "利用後の質問" })).toHaveCount(0);
  await page.evaluate(() => (window as any).showSurvey(true));
  await page
    .getByRole("radio", { name: "かんたんだった", exact: true })
    .check();
  await page.getByRole("button", { name: "回答を記録する" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "回答を記録する" }).click();
  await expect(page.getByRole("status")).toHaveText("回答を記録しました。");
  const rows = await page.evaluate(() => (window as any).testRecords);
  expect(rows).toHaveLength(1);
  expect(rows[0].answers).toEqual({ ease: 3 });
  await page.evaluate(() => (window as any).showSurvey(false));
  await expect(page.getByRole("form", { name: "利用後の質問" })).toHaveCount(0);
  await page.evaluate(() => (window as any).showSurvey(true));
  await expect(
    page.getByRole("radio", { name: "かんたんだった", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "答えずに終わる" }).click();
  expect(await page.evaluate(() => (window as any).skipped)).toBe(true);
  expect(await page.evaluate(() => (window as any).testRecords.length)).toBe(1);
  await page.evaluate(() => {
    (window as any).holdSave = true;
  });
  await page.getByRole("button", { name: "回答を記録する" }).click();
  await expect(page.getByRole("button", { name: "記録中…" })).toBeDisabled();
  await page.evaluate(() => (window as any).showSurvey(false));
  await expect(page.getByRole("form", { name: "利用後の質問" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).pendingSignal.aborted)).toBe(
    true,
  );
  await page.evaluate(() => (window as any).releaseSave());
  expect(await page.evaluate(() => (window as any).testRecords.length)).toBe(1);
});

test("保存チェックの拒否・タイムアウトを失敗として返す", async ({ page }) => {
  await page.goto("./");
  const { code } = await transform(
    readFileSync("src/future/storageCheck.ts", "utf8"),
    {
      loader: "ts",
      format: "iife",
      globalName: "FutureStorage",
      target: "es2022",
    },
  );
  await page.addScriptTag({ content: code });
  const result = await page.evaluate(async () => {
    const api = (window as any).FutureStorage;
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: () => Promise.reject(new Error("denied")),
        persisted: () => Promise.reject(new Error("denied")),
      },
    });
    const status = await api.inspectStorage();
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw new Error("denied");
        },
        deleteDatabase() {
          const request: any = {};
          setTimeout(() => request.onsuccess?.(), 0);
          return request;
        },
      },
    });
    const failed = await api.probeStorage(100);
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          return {};
        },
        deleteDatabase() {
          const request: any = {};
          setTimeout(() => request.onblocked?.(), 0);
          return request;
        },
      },
    });
    const timeout = await api.probeStorage(100);
    return { status, failed, timeout };
  });
  expect(result.status.estimateStatus).toBe("unavailable");
  expect(result.status.persisted).toBeUndefined();
  expect(result.failed).toEqual({
    writable: false,
    cleanup: "complete",
    reason: "failed",
  });
  expect(result.timeout).toEqual({
    writable: false,
    cleanup: "pending",
    reason: "timeout",
  });
});
