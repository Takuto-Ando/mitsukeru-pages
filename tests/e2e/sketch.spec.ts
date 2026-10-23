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
    .getByRole("button", { name: "カメラが使えないので手動で選ぶ" })
    .click();
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
    page.getByRole("heading", { name: "だいはっけん！" }),
  ).toBeVisible();
  const points = await page
    .getByTestId("user-lines")
    .locator("polyline")
    .getAttribute("points");
  await page.getByRole("button", { name: "正解", exact: true }).click();
  await expect(page.getByTestId("user-lines")).toHaveAttribute(
    "visibility",
    "hidden",
  );
  await page.getByRole("button", { name: "重ねる", exact: true }).click();
  await expect(
    page.getByTestId("user-lines").locator("polyline"),
  ).toHaveAttribute("points", points!);
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
      page.getByText("提案課題・自動判定は未検証。実物を見て自己確認します。"),
    ).toBeVisible();
    await draw(page);
    await page.getByRole("button", { name: "こたえあわせ →" }).click();
    await expect(page.getByRole("status")).toContainText(
      "実物でも、こんな形に見えた？",
    );
    await page.getByRole("button", { name: "うん、実物でも見えた" }).click();
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

test("シャッターで写真を保持してから未認識の手動選択を出す", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Canvas captureStream mock is Chromium-only; physical iPhone camera needs device testing.",
  );
  await page.addInitScript(() => {
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
  await expect(page.locator(".animal-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "シャッター", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真" }),
  ).toBeVisible();
  await expect(page.locator(".animal-grid button")).toHaveCount(16);
  await expect(
    page.getByRole("status").filter({ hasText: "自動認識モデルは未導入" }),
  ).toBeVisible();
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
    touchPoints: [{ x: b.x + 30, y: b.y + 100, id: 0 }],
  });
  for (let i = 1; i <= 20; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: b.x + 30 + i * 8, y: b.y + 100 + Math.sin(i / 4) * 20, id: 0 },
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
