import { test, expect, type Page } from "@playwright/test";
import { groups } from "../../src/content/groups";
async function select(page: Page, id: string) {
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
      name: new RegExp(groups.find((g) => g.id === id)!.name),
    })
    .click();
}
async function draw(page: Page) {
  const c = page.getByTestId("canvas");
  await c.scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height * 0.45);
  await page.mouse.down();
  for (const [x, y] of [
    [0.75, 0.45],
    [0.75, 0.6],
    [0.25, 0.6],
    [0.25, 0.45],
  ])
    await page.mouse.move(b.x + b.width * x, b.y + b.height * y, { steps: 8 });
  await page.mouse.up();
}
test("Figma4画面・描画・Undo・判定・重ね合わせ・解説", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await select(page, "goat");
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await draw(page);
  await page.getByRole("button", { name: "ひとつ戻す" }).click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await draw(page);
  await page.screenshot({
    path: `test-results/figma-draw-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  await expect(
    page.getByRole("heading", { name: "特徴を見つけたね！" }),
  ).toBeVisible();
  const points = await page
    .getByTestId("user-lines")
    .locator("polyline")
    .evaluateAll((elements) => elements.map((e) => e.getAttribute("points")));
  await page.getByRole("button", { name: "お手本", exact: true }).click();
  await expect(page.getByTestId("user-lines")).toHaveAttribute(
    "visibility",
    "hidden",
  );
  await page.getByRole("button", { name: "重ね合わせ", exact: true }).click();
  expect(
    await page
      .getByTestId("user-lines")
      .locator("polyline")
      .evaluateAll((elements) => elements.map((e) => e.getAttribute("points"))),
  ).toEqual(points);
  await page.screenshot({
    path: `test-results/figma-compare-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "どうして横長なの？ →" }).click();
  await expect(
    page.getByRole("heading", { name: "まわりを広く見るため！" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/figma-learn-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "次の動物を撮る" }).click();
  await expect(
    page.getByRole("heading", { name: "どの動物を見ている？" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
for (const group of groups.filter((g) => g.id !== "goat"))
  test(`${group.name} 専用提案課題から自己確認・比較・解説`, async ({
    page,
  }) => {
    await select(page, group.id);
    await expect(
      page.getByText(
        "提案課題です。特徴で判定し、迷ったときは自分で確かめます。",
      ),
    ).toBeVisible();
    await draw(page);
    await page.getByRole("button", { name: "こたえあわせ →" }).click();
    await expect(
      page
        .locator(".figma-feedback")
        .or(page.getByRole("heading", { name: "特徴を見つけたね！" })),
    ).toBeVisible();
    if (await page.locator(".figma-feedback").count())
      await page
        .getByRole("button", { name: /うん、実物でも見えた|お手本で確かめる/ })
        .click();
    await expect(page.getByTestId("answer-shape")).toHaveAttribute(
      "visibility",
      "hidden",
    );
    await page.getByRole("button", { name: "重ね合わせ", exact: true }).click();
    await expect(page.getByTestId("answer-shape")).toBeVisible();
    await page.getByRole("button", { name: "特徴について知ろう →" }).click();
    await expect(
      page.getByRole("heading", { name: "分かっていること" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "次の動物を撮る" }).click();
    await expect(
      page.getByRole("heading", { name: "どの動物を見ている？" }),
    ).toBeVisible();
  });
test("スマホ幅・素材・ファイル入力なし", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  for (const width of [320, 393, 844]) {
    await page.setViewportSize({ width, height: 852 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({
    path: `test-results/figma-camera-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("シャッター・AI候補の確認・手動選択（推論Workerはモック）", async ({
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
      postMessage() {
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                type: "result",
                result: {
                  status: "candidates",
                  candidates: [{ groupId: "goat", score: 0.75 }],
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
  await page.getByRole("button", { name: "シャッター", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真" }),
  ).toBeVisible();
  await expect(page.locator(".animal-grid button")).toHaveCount(16);
  await expect(
    page.getByText("撮影した写真を見て、動物を選んでね。"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "AIで候補を探す", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "この動物かな？" }),
  ).toBeVisible();
  await expect(page.locator(".animal-grid button")).toHaveCount(16);
  await page
    .getByRole("button", { name: "ヤギ・ヒツジ を観察する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/capture-mobile.png",
    fullPage: true,
  });
});

test("実タッチイベント・素材読込・reduced motion", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP injection is Chromium-only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await select(page, "goat");
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + 30, y: b.y + b.height * 0.5, id: 0 }],
  });
  for (let i = 1; i <= 20; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: b.x + 30 + i * 8,
          y: b.y + b.height * 0.5 + Math.sin(i / 4) * 10,
          id: 0,
        },
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeEnabled();
  await expect(canvas).toHaveCSS("touch-action", "none");
  const assets = await page.evaluate(async () => {
    const paths = [
      "figma/2-26-imgEyeOuter.svg",
      "figma/2-26-imgEyeIris.svg",
      "figma/2-26-imgMascotCuriousLittleEyeCreature.svg",
    ];
    return Promise.all(
      paths.map(async (p) => {
        const r = await fetch(new URL(p, location.href));
        return r.ok && (await r.text()).includes("<svg");
      }),
    );
  });
  expect(assets.every(Boolean)).toBe(true);
  await session.detach();
});

test("ボタンが94%に縮みSpringで戻り、正解は半透明の黒", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await select(page, "goat");
  const button = page.getByRole("button", { name: "✧ ヒント", exact: true });
  await button.scrollIntoViewIfNeeded();
  const bounds = (await button.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await expect
    .poll(() =>
      button.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a),
    )
    .toBeLessThan(0.96);
  await page.mouse.up();
  await expect
    .poll(() =>
      button.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a),
    )
    .toBeGreaterThan(0.99);
  await draw(page);
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  await expect(
    page.getByTestId("answer-shape").locator("rect"),
  ).toHaveAttribute("fill", "#242e2b");
  await expect(page.getByTestId("answer-shape")).toHaveCSS("opacity", "0.4");
});

test("空白マスクの外は回答不可、完成まで背景と座標を保持", async ({ page }) => {
  await select(page, "goat");
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  let b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + 5, b.y + 5);
  await page.mouse.down();
  await page.mouse.move(b.x + 30, b.y + 30, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "こたえあわせ →" }),
  ).toBeDisabled();
  await expect(page.getByTestId("animal-background")).toBeVisible();
  await draw(page);
  const image = await canvas.evaluate((e) => {
    const c = e as HTMLCanvasElement;
    return c.getContext("2d")!.getImageData(0, 0, 1, 1).data[3];
  });
  expect(image).toBe(0);
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  await expect(page.getByTestId("answer-shape")).toHaveAttribute(
    "visibility",
    "hidden",
  );
  await expect(page.getByTestId("user-lines")).toHaveAttribute(
    "visibility",
    "visible",
  );
  const lines = page.getByTestId("user-lines");
  const initial = await lines.innerHTML();
  for (const width of [320, 393, 844]) {
    await page.setViewportSize({ width, height: 852 });
    expect(await lines.innerHTML()).toBe(initial);
    await expect(page.locator(".comparison-overlay")).toHaveAttribute(
      "viewBox",
      "0 0 600 400",
    );
    await expect(page.getByTestId("animal-background")).toBeVisible();
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({
    path: `test-results/completed-animal-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("ヤギ以外の両腕を自動判定し、きらめきと星の完成演出を表示", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await select(page, "gibbon");
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  for (const stroke of [
    [
      [130, 85],
      [245, 210],
    ],
    [
      [470, 85],
      [345, 210],
    ],
  ]) {
    await page.mouse.move(
      b.x + (stroke[0][0] / 600) * b.width,
      b.y + (stroke[0][1] / 400) * b.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      b.x + (stroke[1][0] / 600) * b.width,
      b.y + (stroke[1][1] / 400) * b.height,
      { steps: 20 },
    );
    await page.mouse.up();
  }
  await expect(page.locator(".stroke-sparkle")).toHaveCount(1);
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  await expect(
    page.getByRole("heading", { name: "特徴を見つけたね！" }),
  ).toBeVisible();
  await expect(page.locator(".discovery-star")).toHaveCount(6);
  await expect(page.getByTestId("answer-shape")).toHaveAttribute(
    "visibility",
    "hidden",
  );
  await page.screenshot({
    path: `test-results/gibbon-discovery-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("動物の絵を保存・再読込・見返し・比較・削除できる", async ({ page }) => {
  await select(page, "goat");
  await draw(page);
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  const original = await page
    .getByTestId("user-lines")
    .locator("polyline")
    .evaluateAll((es) => es.map((e) => e.getAttribute("points")));
  await page.getByRole("button", { name: "この動物を保存する" }).click();
  await expect(
    page.getByRole("button", { name: "保存したよ！" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "描いた動物 (1)" }).click();
  await page.screenshot({
    path: `test-results/collection-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "ヤギ・ヒツジの絵を見返す" }).click();
  await expect(page.getByTestId("user-lines").locator("polyline")).toHaveCount(
    original.length,
  );
  const saved = await page
    .getByTestId("user-lines")
    .locator("polyline")
    .evaluateAll((es) => es.map((e) => e.getAttribute("points")));
  // Saved coordinates keep 0.01 px precision in the 600 × 400 shared frame.
  expect(saved[0]?.split(" ").length).toBe(original[0]?.split(" ").length);
  await page.getByRole("button", { name: "重ね合わせ", exact: true }).click();
  await expect(page.getByTestId("answer-shape")).toHaveAttribute(
    "visibility",
    "visible",
  );
  await page.getByRole("button", { name: "一覧に戻る" }).click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "残す", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ヤギ・ヒツジの絵を見返す" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "描いた動物 (0)" }).click();
  await expect(page.getByText("0枚の発見を保存しています。")).toBeVisible();
});

test("保存に失敗したとき保存済みと表示しない", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await select(page, "goat");
  await draw(page);
  await page.getByRole("button", { name: "こたえあわせ →" }).click();
  await page.getByRole("button", { name: "この動物を保存する" }).click();
  await expect(page.getByRole("alert")).toContainText("保存できませんでした");
  await expect(
    page.getByRole("button", { name: "この動物を保存する" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "描いた動物 (0)" }),
  ).toBeVisible();
});
