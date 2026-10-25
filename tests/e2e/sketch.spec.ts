import { test, expect, type Page } from "@playwright/test";
import { tasks, tasksForGroup } from "../../src/content/tasks";
import { groups } from "../../src/content/groups";
async function select(page: Page, id = "goat") {
  const task = tasks.find((t) => t.id === id)!;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("denied", "NotAllowedError")),
      },
    }),
  );
  await page.goto("./");
  await page
    .locator(".animal-grid")
    .getByRole("button", {
      name: new RegExp(groups.find((g) => g.id === task.groupId)!.name),
    })
    .click();
  if (tasksForGroup(task.groupId).length > 1)
    await page
      .getByRole("group", { name: "観察する部位" })
      .getByRole("button", { name: task.part, exact: true })
      .click();
}
async function draw(page: Page, id = "goat", vertical = false) {
  const c = page.getByTestId("canvas");
  await page.locator(".drawing-paper").scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!;
  for (const r of tasks.find((t) => t.id === id)!.scene.regions) {
    const cx = (r.x + r.width / 2) * 600,
      cy = (r.y + r.height / 2) * 400;
    const rx = vertical ? 12 : r.width * 600 * 0.36,
      ry = vertical ? r.height * 400 * 0.4 : r.height * 400 * 0.33;
    await page.mouse.move(
      b.x + ((cx + rx) / 600) * b.width,
      b.y + (cy / 400) * b.height,
    );
    await page.mouse.down();
    for (let i = 1; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      await page.mouse.move(
        b.x + ((cx + rx * Math.cos(a)) / 600) * b.width,
        b.y + ((cy + ry * Math.sin(a)) / 400) * b.height,
      );
    }
    await page.mouse.up();
  }
}
async function compare(page: Page) {
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  const review = page.locator(".figma-feedback button");
  if (await review.count()) await review.click();
  await expect(page.locator(".comparison-overlay")).toBeVisible();
}
for (const t of tasks)
  test(`${t.id}: 専用イラスト・描画・比較・確認・解説・再観察`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await select(page, t.id);
    await expect(
      page.getByRole("heading", { name: t.part + "を描こう" }),
    ).toBeVisible();
    const href = await page
      .locator(".eye-template image")
      .first()
      .getAttribute("href");
    expect(href).toContain(`whole/${t.id}.svg`);
    const source = await (await page.request.get(href!)).text();
    expect(source).toContain(`data-full-animal="${t.id}"`);
    const correct = await (
      await page.request.get(
        new URL(`illustrations/whole/${t.id}-complete.svg`, page.url()).href,
      )
    ).text();
    expect(correct).toContain('data-illustration="complete"');
    expect(correct).not.toContain("#c18151");
    await expect(
      page.getByRole("button", { name: "こたえあわせ →" }),
    ).toBeDisabled();
    await draw(page, t.id);
    await compare(page);
    const own = page.getByTestId("user-lines");
    const lines = await own
      .locator("polyline")
      .evaluateAll((es) => es.map((e) => e.getAttribute("points")));
    expect(lines.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: "重ね合わせ", exact: true }).click();
    await expect(page.getByTestId("answer-shape")).toHaveAttribute(
      "visibility",
      "visible",
    );
    await expect(own).toHaveAttribute("visibility", "visible");
    expect(
      await own
        .locator("polyline")
        .evaluateAll((es) => es.map((e) => e.getAttribute("points"))),
    ).toEqual(lines);
    await page.getByRole("button", { name: "お手本", exact: true }).click();
    await expect(own).toHaveAttribute("visibility", "hidden");
    await page.getByRole("button", { name: "自分の絵", exact: true }).click();
    await expect(own).toHaveAttribute("visibility", "visible");
    await expect(own).toHaveCSS("opacity", "1");
    await expect(own).toHaveCSS("opacity", "1");
    const confirm = page.getByRole("button", {
      name: "見くらべて、確かめた！",
    });
    if (await confirm.count()) await confirm.click();
    await expect(
      page.getByRole("heading", { name: "完成！ だいはっけん！" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/${t.id}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "特徴について知ろう →" }).click();
    await expect(
      page.getByRole("heading", { name: t.explanation.name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(t.explanation.form, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "もう一度、本物を見てみよう ↗" })
      .click();
    await expect(
      page.getByRole("button", { name: "こたえあわせ →" }),
    ).toBeEnabled();
    await compare(page);
    if (await confirm.count()) await confirm.click();
    await page.getByRole("button", { name: "特徴について知ろう →" }).click();
    await page.getByRole("button", { name: "次の動物を撮る" }).click();
    await expect(page.locator(".animal-grid button")).toHaveCount(16);
    expect(errors).toEqual([]);
  });
test("Undo・全消去・縦長の再観察・横長の楕円", async ({ page }) => {
  await select(page);
  await draw(page);
  await page.getByRole("button", { name: "ひとつ戻す" }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await draw(page, "goat", true);
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  await expect(page.locator(".figma-feedback")).toBeVisible();
  await page.getByRole("button", { name: "描き直す" }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await draw(page);
  await compare(page);
  await expect(
    page.getByRole("heading", { name: "完成！ だいはっけん！" }),
  ).toBeVisible();
});
test("端末内保存・再読込・比較・PNG保存・削除", async ({ page }) => {
  await select(page, "fennec-tail");
  await draw(page, "fennec-tail");
  await compare(page);
  await page.getByRole("button", { name: "見くらべて、確かめた！" }).click();
  await page.getByRole("button", { name: "観察を保存する" }).click();
  await expect(
    page.getByRole("button", { name: "保存したよ！" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "観察ノート (1)" }).click();
  await expect(page.getByText("ふさふさした尾")).toBeVisible();
  await page.getByRole("button", { name: "フェネックの絵を見返す" }).click();
  await expect(page.locator(".comparison-overlay")).toHaveAttribute(
    "aria-label",
    /ふさふさした尾/,
  );
  await expect(
    page.getByRole("slider", { name: "自分の絵とお手本の境目" }),
  ).toHaveAttribute("aria-valuenow", "50");
  const ownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "自分の絵をPNGで保存" }).click();
  expect((await ownDownload).suggestedFilename()).toMatch(
    /^zooketch-fennec-tail-.*-sketch\.png$/,
  );
  const compDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "比較画像をPNGで保存" }).click();
  expect((await compDownload).suggestedFilename()).toMatch(
    /^zooketch-fennec-tail-.*-comparison\.png$/,
  );
  await page.getByRole("button", { name: "重ね合わせ", exact: true }).click();
  await expect(
    page.getByTestId("user-lines").locator("polyline"),
  ).not.toHaveCount(0);
  await page.getByRole("button", { name: "一覧に戻る" }).click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "残す", exact: true }).click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(
    page.getByText("0枚の観察カードを保存しています。"),
  ).toBeVisible();
});
test("保存失敗を保存済みにしない", async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.add = function () {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await select(page);
  await draw(page);
  await compare(page);
  await page.getByRole("button", { name: "観察を保存する" }).click();
  await expect(page.getByRole("alert")).toContainText("保存できません");
  await expect(
    page.getByRole("button", { name: "観察を保存する" }),
  ).toBeEnabled();
});
test("320〜430px・開発メモ非表示・ファイル入力なし", async ({ page }) => {
  await select(page);
  expect(
    await page.evaluate(
      () =>
        typeof (window as unknown as { zooketchStudy?: unknown }).zooketchStudy,
    ),
  ).toBe("undefined");
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    await expect(page.getByTestId("canvas")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await expect(
    page.getByText(/制作待ち|提供資料画像|提案課題です|正式な全30カード/),
  ).toHaveCount(0);
});
test("タッチ入力で描画・マスク外は回答不可", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "実タッチ注入はCDPを使うためChromiumのみ",
  );
  await select(page);
  const c = page.getByTestId("canvas");
  await page.locator(".drawing-paper").scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!;
  const session = await context.newCDPSession(page);
  const pt = (x: number, y: number) => ({
    x: b.x + x * b.width,
    y: b.y + y * b.height,
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [pt(0.01, 0.01)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [pt(0.1, 0.1)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [pt(0.29, 0.34)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [pt(0.44, 0.4)],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeEnabled();
});

test("モデル事前準備・撮影から自動で描画へ（推論Workerはモック）", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Canvas captureStream mock is Chromium-only; physical iPhone camera needs device testing.",
  );
  await page.addInitScript(() => {
    window.Worker = class {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      terminate() {}
      postMessage(data: { photo?: string }) {
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                type: "result",
                result: {
                  ...(data.photo
                    ? {
                        status: "candidates",
                        candidates: [{ groupId: "goat", score: 0.75 }],
                      }
                    : { status: "ready" }),
                },
              },
            }),
          20,
        );
      }
    } as unknown as typeof Worker;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d")!;
          context.fillStyle = "#448877";
          context.fillRect(0, 0, 640, 480);
          const stream = canvas.captureStream(10);
          const timer = setInterval(
            () => context.fillRect(0, 0, 640, 480),
            100,
          );
          stream
            .getVideoTracks()[0]
            .addEventListener("ended", () => clearInterval(timer));
          return stream;
        },
      },
    });
  });
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "シャッター", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".animal-grid button")).toHaveCount(16);
  await page.getByText("撮影の設定", { exact: true }).click();
  await page
    .getByRole("button", { name: "識別モデルを先にダウンロード" })
    .click();
  await expect(
    page.getByRole("button", { name: "識別モデル準備済み" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "シャッター", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/capture-mobile.png",
    fullPage: true,
  });
});

test("紙のカードで全身に直接描き、余計なズームや装飾を出さない", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await select(page);
  await expect(page.getByTestId("drawing-overview")).toHaveCount(0);
  await expect(page.getByTestId("full-animal-stage")).toHaveAttribute(
    "data-view",
    "whole",
  );
  await expect(
    page.getByRole("button", { name: /全体で描く|大きく描く/ }),
  ).toHaveCount(0);
  await expect(page.locator(".figma-confetti, .figma-mascot")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "観察の進み方" }),
  ).not.toContainText(/01|02|03|04/);
  await expect(page.getByText(/1〜3分|1分から3分/)).toHaveCount(0);
  await expect(page.locator(".activity-card")).toHaveCSS("box-shadow", "none");
  const c = (await page.getByTestId("canvas").boundingBox())!,
    b = (await page.locator(".eye-template").boundingBox())!;
  expect(Math.abs(c.x - b.x)).toBeLessThan(1);
  expect(Math.abs(c.height - c.width)).toBeLessThan(1);
  expect(Math.abs(c.height - b.height)).toBeLessThan(1);
  await draw(page);
  await compare(page);
  await page.getByRole("button", { name: "お手本", exact: true }).click();
  await expect(page.getByTestId("answer-shape")).toHaveAttribute(
    "data-answer-kind",
    "complete-animal",
  );
  await expect(
    page.getByTestId("answer-shape").locator("image"),
  ).toHaveAttribute("href", /whole\/goat-complete.svg/);
  await expect(page.getByTestId("user-lines")).toHaveAttribute(
    "visibility",
    "hidden",
  );
});

test("点をひとつ描けて、旧localStorageデータを移行し、全身版の線を再読込後も保存できる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mitsukeru.collection.v1")) {
      localStorage.setItem(
        "mitsukeru.collection.v1",
        JSON.stringify({
          version: 1,
          drawings: [
            {
              id: "legacy-goat",
              groupId: "goat",
              taskId: "goat",
              sceneVersion: 2,
              createdAt: "2026-10-23T12:00:00.000Z",
              outcome: "correct",
              strokes: [
                [
                  { x: 200, y: 215 },
                  { x: 250, y: 220 },
                ],
              ],
            },
          ],
        }),
      );
    }
  });
  await select(page, "deer");
  await expect(
    page.getByRole("button", { name: "観察ノート (1)" }),
  ).toBeVisible();
  const c = page.getByTestId("canvas");
  await page.locator(".drawing-paper").scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!,
    r = tasks.find((t) => t.id === "deer")!.scene.regions[0];
  await page.mouse.click(
    b.x + (r.x + r.width / 2) * b.width,
    b.y + (r.y + r.height / 2) * b.height,
  );
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeEnabled();
  await compare(page);
  await page.getByRole("button", { name: "見くらべて、確かめた！" }).click();
  await page.getByRole("button", { name: "観察を保存する" }).click();
  await expect(
    page.getByRole("button", { name: "保存したよ！" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "観察ノート (2)" }).click();
  await page.getByRole("button", { name: "ニホンジカの絵を見返す" }).click();
  await expect(page.locator(".comparison-overlay")).toHaveAttribute(
    "viewBox",
    "0 0 600 600",
  );
});

test("消しゴム・全消去からUndoで復元し、段階的な観察ヒントで空欄の案内も再表示", async ({
  page,
}) => {
  await select(page);
  await expect(page.getByTestId("drawing-target")).toBeVisible();
  await draw(page);
  await expect(page.getByTestId("drawing-target")).toHaveCount(0);
  await expect
    .poll(() =>
      page.getByTestId("canvas").evaluate((node) => {
        const canvas = node as HTMLCanvasElement,
          scale = canvas.width / 600;
        return canvas
          .getContext("2d")!
          .getImageData(
            Math.round(263.2 * scale),
            Math.round(220 * scale),
            1,
            1,
          ).data[3];
      }),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "ヒントを見る", exact: true }).click();
  await expect(page.getByTestId("drawing-target")).toBeVisible();
  await expect(page.getByText("目の真ん中を見てみよう。")).toBeVisible();
  await expect(page.getByText("縦と横、どちらに長いかな？")).toHaveCount(0);
  await page
    .getByRole("button", { name: "次のヒントを見る", exact: true })
    .click();
  await expect(page.getByText("縦と横、どちらに長いかな？")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ヒントを表示中", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "描き直す", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "ひとつ戻す", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "消しゴム", exact: true }).click();
  await page.locator(".drawing-paper").scrollIntoViewIfNeeded();
  const b = (await page.getByTestId("canvas").boundingBox())!;
  const r = tasks.find((t) => t.id === "goat")!.scene.regions[0];
  await page.mouse.click(
    b.x + (r.x + r.width * 0.86) * b.width,
    b.y + (r.y + r.height / 2) * b.height,
  );
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "ひとつ戻す", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeEnabled();
});

test("シカは模様が見えない観察も尊重し、空白のヤギを回答扱いしない", async ({
  page,
}) => {
  await select(page, "deer");
  await page
    .getByRole("button", { name: "模様が見えないので、見くらべる" })
    .click();
  await expect(
    page.getByText("お手本は夏の模様。いま見えた姿と見くらべよう。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "見くらべて、確かめた！" }).click();
  await expect(
    page.getByRole("button", { name: "観察を保存する" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "特徴について知ろう →" }).click();
  await expect(
    page.getByText(tasks.find((t) => t.id === "deer")!.explanation.form, {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "次の動物を撮る" }).click();
  await page
    .locator(".animal-grid")
    .getByRole("button", { name: /ヤギ/ })
    .click();
  await expect(
    page.getByRole("button", { name: "模様が見えないので、見くらべる" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
});

test("比較スライダーのポインタ・キーボード操作と画面幅変更時の位置固定", async ({
  page,
}) => {
  await select(page);
  await draw(page);
  await compare(page);
  const slider = page.getByRole("slider", { name: "自分の絵とお手本の境目" });
  await expect(slider).toHaveAttribute("aria-valuenow", "50");
  const overlay = page.locator(".comparison-overlay");
  const beforeBox = (await overlay.boundingBox())!;
  await page.mouse.move(
    beforeBox.x + beforeBox.width * 0.5,
    beforeBox.y + beforeBox.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    beforeBox.x + beforeBox.width * 0.25,
    beforeBox.y + beforeBox.height * 0.5,
  );
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", "25");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "26");
  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await page.setViewportSize({ width: 320, height: 852 });
  const stageBox = (await page.locator(".comparison-stage").boundingBox())!;
  const svgBox = (await overlay.boundingBox())!;
  expect(Math.abs(stageBox.width - svgBox.width)).toBeLessThan(3);
  expect(Math.abs(stageBox.height - svgBox.height)).toBeLessThan(3);
});

test("研究用ログ：同意前は記録せず、同意後の記録・JSON/CSV出力・撤回削除が動作する", async ({
  page,
}) => {
  await select(page);
  await draw(page);
  // Before consent, no study events exist in IndexedDB
  const countBefore = await page.evaluate(async () => {
    const req = indexedDB.open("zooketch.observation-notebook", 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction("researchEvents", "readonly");
    return await new Promise<number>((resolve) => {
      const c = tx.objectStore("researchEvents").count();
      c.onsuccess = () => resolve(c.result);
    });
  });
  expect(countBefore).toBe(0);

  await page.getByText("研究への参加・記録").click();
  await page.getByPlaceholder("空欄なら自動生成（例: P-01）").fill("TEST-01");
  await page.getByLabel("説明を読み、研究用の操作記録に同意します").check();
  await page.getByRole("button", { name: "同意して記録を始める" }).click();
  await expect(page.getByText("研究記録中・参加設定")).toBeVisible();

  await page.getByRole("button", { name: "ズーケッチ 撮影に戻る" }).click();
  await page
    .locator(".animal-grid")
    .getByRole("button", { name: /ヤギ/ })
    .click();
  await page.getByRole("button", { name: "ヒントを見る" }).click();
  await draw(page);
  await compare(page);
  const slider = page.getByRole("slider", { name: "自分の絵とお手本の境目" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "特徴について知ろう →" }).click();
  await page.getByRole("button", { name: "観察を保存する" }).click();
  await page.getByRole("button", { name: "研究記録を終了する" }).click();

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "研究ログをJSONで保存" }).click();
  const jsonFile = await jsonDownload;
  expect(jsonFile.suggestedFilename()).toMatch(/^zooketch-study-.*\.json$/);

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "研究ログをCSVで保存" }).click();
  const csvFile = await csvDownload;
  expect(csvFile.suggestedFilename()).toMatch(/^zooketch-study-.*\.csv$/);

  await page
    .getByRole("button", { name: "同意を撤回して研究ログを削除" })
    .click();
  const countAfter = await page.evaluate(async () => {
    const req = indexedDB.open("zooketch.observation-notebook", 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction("researchEvents", "readonly");
    return await new Promise<number>((resolve) => {
      const c = tx.objectStore("researchEvents").count();
      c.onsuccess = () => resolve(c.result);
    });
  });
  expect(countAfter).toBe(0);
});

test("読み上げは明示タップ時のみ、停止・速度変更・OFFができる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: { text: string; rate: number }[] = [];
    Object.assign(window, {
      speechCalls: calls,
      SpeechSynthesisUtterance: class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "ja-JP" }],
        cancel: () => {},
        speak: (u: { text: string; rate: number }) =>
          calls.push({ text: u.text, rate: u.rate }),
      },
    });
  });
  await select(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { speechCalls: unknown[] }).speechCalls.length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "読み上げる", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { speechCalls: unknown[] }).speechCalls.length,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "読み上げを止める", exact: true })
    .click();
  await page.getByText("読み上げの設定", { exact: true }).click();
  await page.getByLabel("読む速さ", { exact: true }).selectOption("0.7");
  await page.getByRole("button", { name: "読み上げる", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { speechCalls: { rate: number }[] }
        ).speechCalls.at(-1)?.rate,
    ),
  ).toBe(0.7);
  await page.getByLabel("読み上げボタンを使う").uncheck();
  await expect(
    page.getByRole("button", { name: "読み上げを止める", exact: true }),
  ).toHaveCount(0);
});

test("研究モードで2回描き、画像・回ごとの指標を記録して撤回で消去する", async ({
  page,
}) => {
  await select(page);
  await page.getByRole("button", { name: "ズーケッチ 撮影に戻る" }).click();
  await page.getByText("研究への参加・記録", { exact: true }).click();
  await page.getByLabel("同じ課題を2回描く研究モードを使う").check();
  await page.getByLabel("説明を読み、研究用の操作記録に同意します").check();
  await page.getByRole("button", { name: "同意して記録を始める" }).click();
  await page
    .locator(".animal-grid button")
    .filter({ hasText: "ヤギ・ヒツジ" })
    .click();
  await draw(page);
  await compare(page);
  const confirm = page.getByRole("button", { name: "見くらべて、確かめた！" });
  if (await confirm.count()) await confirm.click();
  await page.getByRole("button", { name: "特徴について知ろう →" }).click();
  await page.getByRole("button", { name: "同じ特徴をもう一度描く" }).click();
  await expect(
    page.getByText("2回目のスケッチ", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await draw(page);
  await compare(page);
  if (await confirm.count()) await confirm.click();
  await page.getByRole("button", { name: "特徴について知ろう →" }).click();
  await expect(
    page.getByRole("img", { name: "1回目の描画", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "2回目の描画", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2回の描画をこの端末に記録しました。", { exact: true }),
  ).toBeVisible();
  const readSettings = () =>
    page.evaluate(async () => {
      const req = indexedDB.open("zooketch.observation-notebook", 1);
      const db = await new Promise<IDBDatabase>((resolve) => {
        req.onsuccess = () => resolve(req.result);
      });
      return new Promise<
        {
          id: string;
          before?: { image: string; metrics: { submissions: number } };
          after?: { image: string; metrics: { submissions: number } };
        }[]
      >((resolve) => {
        const request = db
          .transaction("settings")
          .objectStore("settings")
          .getAll();
        request.onsuccess = () => resolve(request.result);
      });
    });
  const pairs = (await readSettings()).filter((r) =>
    r.id.startsWith("study-pair:"),
  );
  expect(pairs).toHaveLength(1);
  expect(pairs[0].before?.image).toMatch(/^data:image\/png/);
  expect(pairs[0].after?.image).toMatch(/^data:image\/png/);
  expect(pairs[0].before?.metrics.submissions).toBe(1);
  expect(pairs[0].after?.metrics.submissions).toBe(1);
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "研究ログをJSONで保存" }).click();
  const jsonPath = await (await exported).path();
  const { readFile } = await import("node:fs/promises");
  const json = JSON.parse(await readFile(jsonPath!, "utf8"));
  expect(json.pairs).toHaveLength(1);
  expect(json.pairs[0].before.image).toMatch(/^data:image\/png/);
  expect(json.events.some((e: { phase: string }) => e.phase === "before")).toBe(
    true,
  );
  expect(json.events.some((e: { phase: string }) => e.phase === "after")).toBe(
    true,
  );
  expect(json.pairs[0].before.strokes).toBeUndefined();
  await page
    .getByRole("button", { name: "観察を保存する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "観察ノート (1)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "同意を撤回して研究ログを削除" })
    .click();
  await expect
    .poll(
      async () =>
        (await readSettings()).filter((r) => r.id.startsWith("study-pair:"))
          .length,
    )
    .toBe(0);
  await expect(
    page.getByRole("button", { name: "観察ノート (1)", exact: true }),
  ).toBeVisible();
});

test("公開ビルドを準備後、オフライン再読込・描画・ノート保存ができる", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.E2E_PREVIEW !== "1",
    "Service Worker is generated only for a production build.",
  );
  await select(page);
  await page.getByText("通信・オフライン", { exact: true }).click();
  await expect(
    page.getByText("オフライン準備完了（観察・ノート）", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await context.setOffline(true);
  await page.reload();
  await page
    .locator(".animal-grid button")
    .filter({ hasText: "ヤギ・ヒツジ" })
    .click();
  await draw(page);
  await compare(page);
  const confirm = page.getByRole("button", { name: "見くらべて、確かめた！" });
  if (await confirm.count()) await confirm.click();
  await page
    .getByRole("button", { name: "観察を保存する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "保存したよ！", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "観察ノート (1)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ヤギ・ヒツジの絵を見返す", exact: true })
    .click();
  await expect(page.getByRole("slider")).toBeVisible();
  const file = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "自分の絵をPNGで保存", exact: true })
    .click();
  const download = await file;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const target = `test-results/zooketch-card-${test.info().project.name}.png`;
  await download.saveAs(target);
  const { readFile } = await import("node:fs/promises");
  const image = await readFile(target);
  expect(image.readUInt32BE(16)).toBe(1200);
  expect(image.readUInt32BE(20)).toBeGreaterThan(1500);
});

test("同意前の描画を研究の1回目へ遡って保存しない", async ({ page }) => {
  await select(page);
  await draw(page);
  await compare(page);
  const confirm = page.getByRole("button", { name: "見くらべて、確かめた！" });
  if (await confirm.count()) await confirm.click();
  await page.getByRole("button", { name: "特徴について知ろう →" }).click();
  await page.getByText("研究への参加・記録", { exact: true }).click();
  await page.getByLabel("同じ課題を2回描く研究モードを使う").check();
  await page.getByLabel("説明を読み、研究用の操作記録に同意します").check();
  await page.getByRole("button", { name: "同意して記録を始める" }).click();
  await expect(
    page.getByRole("button", { name: "同じ特徴をもう一度描く" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "2回の描画の比較" }),
  ).toHaveCount(0);
});
