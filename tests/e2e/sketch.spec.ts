import { test, expect, type Page } from "@playwright/test";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.get(page)!.push(`${response.status()} ${response.url()}`);
  });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function start(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "ヤギを選んではじめる" }).click();
  await expect(
    page.getByRole("heading", { name: /ヤギの目を、\s*よーく見てみよう。/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "見えたかたちを描く" }).click();
}
async function draw(page: Page, shape: number[][]) {
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + (shape[0][0] / 600) * bounds.width,
    bounds.y + (shape[0][1] / 400) * bounds.height,
  );
  await page.mouse.down();
  for (const point of shape.slice(1))
    await page.mouse.move(
      bounds.x + (point[0] / 600) * bounds.width,
      bounds.y + (point[1] / 400) * bounds.height,
      { steps: 10 },
    );
  await page.mouse.up();
}
const rectangle = [
  [130, 150],
  [470, 150],
  [470, 250],
  [130, 250],
  [130, 150],
];
test("観察→描画→答え合わせ→解説の全体験", async ({ page }) => {
  await start(page);
  await expect(page.getByText("横長", { exact: true })).toHaveCount(0);
  await draw(page, rectangle);
  await page.screenshot({
    path: "test-results/drawing-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect(page.getByRole("heading", { name: "大発見！" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "ヤギの横長の瞳孔の模式図" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/success-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "どうして横長なの？" }).click();
  await expect(
    page.getByRole("heading", { name: /横長の瞳には、\s*わけがある。/ }),
  ).toBeVisible();
  await expect(
    page.getByText("役立つと考えられているよ。", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/explanation-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "もう一度、本物の目を見てみよう" })
    .click();
  await page.getByRole("button", { name: "見えたかたちを描く" }).click();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeDisabled();
});
test("横線は自己確認を促し、Undo・消しゴムが動く", async ({ page }) => {
  await start(page);
  await draw(page, [
    [100, 200],
    [500, 200],
  ]);
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect(page.getByRole("status")).toContainText("横長に見えた？");
  await expect(page.getByRole("note")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "ヤギの横長の瞳孔の模式図" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "ひとつ戻す" }).click();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeDisabled();
  await draw(page, rectangle);
  await page.getByRole("button", { name: "消しゴム", exact: true }).click();
  await draw(page, [
    [300, 150],
    [302, 150],
  ]);
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "ペン", exact: true }).click();
  await draw(page, rectangle);
  await page.getByRole("button", { name: "描き直す", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeDisabled();
});
test("カメラ拒否後もヤギを手動で選べる", async ({ page }) => {
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
  await page.getByRole("button", { name: "どうぶつをかざす" }).click();
  await expect(page.getByRole("status")).toContainText(
    "カメラを使えなくても大丈夫",
  );
  await expect(
    page.getByText("動物の自動認識は、まだありません。", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "今回のかんさつ ヤギ 目の中の、ひみつを見つけよう。",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: /ヤギの目を、\s*よーく見てみよう。/ }),
  ).toBeVisible();
});
test("効果音は初期OFF、切替を保存しON時だけ正解音を鳴らす", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const AudioClass = window.AudioContext;
    if (!AudioClass) return;
    const original = AudioClass.prototype.createOscillator;
    Object.defineProperty(window, "playedNotes", { value: 0, writable: true });
    AudioClass.prototype.createOscillator = function () {
      const oscillator = original.call(this);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (...args: Parameters<typeof oscillator.start>) => {
        (window as typeof window & { playedNotes: number }).playedNotes++;
        start(...args);
      };
      return oscillator;
    };
  });
  await start(page);
  await expect(
    page.getByRole("button", { name: "効果音をオンにする" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "効果音をオンにする" }).click();
  await expect(
    page.getByRole("button", { name: "効果音をオフにする" }),
  ).toHaveAttribute("aria-pressed", "true");
  await draw(page, rectangle);
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { playedNotes: number }).playedNotes,
      ),
    )
    .toBe(3);
  await page.getByRole("button", { name: "効果音をオフにする" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "効果音をオンにする" }),
  ).toBeVisible();
});
test("タッチ型Pointer入力、スクロール抑止、未回答の解説ガード", async ({
  page,
}) => {
  await start(page);
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  expect(
    await canvas.evaluate((element) => getComputedStyle(element).touchAction),
  ).toBe("none");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + (130 / 600) * bounds.width,
    bounds.y + (150 / 400) * bounds.height,
  );
  await page.mouse.down();
  for (const point of rectangle.slice(1))
    await canvas.dispatchEvent("pointermove", {
      pointerId: 1,
      pointerType: "touch",
      buttons: 1,
      clientX: bounds.x + (point[0] / 600) * bounds.width,
      clientY: bounds.y + (point[1] / 400) * bounds.height,
    });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    clientX: bounds.x + (130 / 600) * bounds.width,
    clientY: bounds.y + (150 / 400) * bounds.height,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeEnabled();
  await page.goto("./#explain");
  await expect(
    page.getByRole("heading", { name: "まずは、よく見てみよう。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "ヤギの横長の瞳孔の模式図" }),
  ).toHaveCount(0);
});
test("スマホ各幅とPCで崩れず、余計なゲーム機能がない", async ({ page }) => {
  for (const width of [320, 375, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ["home", "observe", "draw", "camera"]) {
      await page.goto("./#" + screen);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.screenshot({
    path: "test-results/home-mobile-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", {
      name: /図鑑|ランキング|ポイント|ログイン|設定/,
    }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/home-desktop-" + test.info().project.name + ".png",
    fullPage: true,
  });
});

test("別の指のキャンセルで描画を失わず、主ポインタの中断は破棄する", async ({
  page,
}) => {
  await start(page);
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 40, bounds.y + 40);
  await page.mouse.down();
  await canvas.dispatchEvent("pointercancel", {
    pointerId: 99,
    pointerType: "touch",
  });
  await page.mouse.move(bounds.x + 100, bounds.y + 50, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "描き直す", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const next = (await canvas.boundingBox())!;
  await page.mouse.move(next.x + 40, next.y + 40);
  await page.mouse.down();
  await page.mouse.move(next.x + 90, next.y + 50);
  await canvas.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeDisabled();
});

test("ブラウザのタッチ入力で輪郭を描いて正解する", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CDP touch injection is available only in Chromium; iPhone requires a device check.",
  );
  await start(page);
  const canvas = page.getByTestId("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const touch = (point: number[]) => ({
    x: bounds.x + (point[0] / 600) * bounds.width,
    y: bounds.y + (point[1] / 400) * bounds.height,
    id: 0,
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touch(rectangle[0])],
  });
  for (let side = 1; side < rectangle.length; side++) {
    for (let i = 1; i <= 12; i++) {
      const a = rectangle[side - 1],
        b = rectangle[side];
      const point = [
        a[0] + ((b[0] - a[0]) * i) / 12,
        a[1] + ((b[1] - a[1]) * i) / 12,
      ];
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [touch(point)],
      });
    }
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect(page.getByRole("heading", { name: "大発見！" })).toBeVisible();
  await session.detach();
});

test("曖昧な横線でも本人の確認で解説へ進める", async ({ page }) => {
  await start(page);
  await draw(page, [
    [100, 200],
    [500, 200],
  ]);
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect(page.getByRole("status")).toContainText("横長に見えた？");
  await page.getByRole("button", { name: "うん、横長に見えた" }).click();
  await expect(
    page.getByRole("heading", { name: /横長の瞳には/ }),
  ).toBeVisible();
});
test("縦長でも解説で確かめられる", async ({ page }) => {
  await start(page);
  await draw(page, [
    [250, 80],
    [350, 80],
    [350, 320],
    [250, 320],
    [250, 80],
  ]);
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect(page.getByRole("status")).toContainText(
    "縦と横、どちらに長いかな？",
  );
  await page.getByRole("button", { name: "解説を見て確かめる" }).click();
  await expect(
    page.getByRole("heading", { name: /横長の瞳には/ }),
  ).toBeVisible();
});

test("iPhone幅で自分の線を保持し、正解を同一座標で重ねて切り替える", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await start(page);
  await draw(page, rectangle);
  await page.getByRole("button", { name: "これで答える" }).click();
  await expect(page.getByRole("heading", { name: "大発見！" })).toBeVisible();
  const overlay = page.locator(".comparison-overlay");
  const lines = page.getByTestId("user-lines");
  const answer = page.getByTestId("answer-shape");
  await expect(overlay).toHaveAttribute("viewBox", "0 0 600 400");
  await expect(answer).toHaveCSS("opacity", "0.4");
  await expect(lines).toHaveAttribute("visibility", "visible");
  const points = await lines.locator("polyline").getAttribute("points");
  expect(points).toBeTruthy();
  await page.getByRole("button", { name: "自分の絵", exact: true }).click();
  await expect(answer).toHaveAttribute("visibility", "hidden");
  await expect(lines).toHaveAttribute("visibility", "visible");
  await page.getByRole("button", { name: "お手本", exact: true }).click();
  await expect(lines).toHaveAttribute("visibility", "hidden");
  await expect(answer).toHaveAttribute("visibility", "visible");
  await page.getByRole("button", { name: "重ねる", exact: true }).click();
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(lines.locator("polyline")).toHaveAttribute("points", points!);
    await expect(overlay).toHaveAttribute("viewBox", "0 0 600 400");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `test-results/overlay-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "どうして横長なの？" }).click();
  await expect(
    page.getByRole("heading", { name: /横長の瞳には/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "もう一度、本物の目を見てみよう" })
    .click();
  await page.getByRole("button", { name: "見えたかたちを描く" }).click();
  await expect(
    page.getByRole("button", { name: "これで答える" }),
  ).toBeDisabled();
});

test("16グループすべてで対応する観察課題が表示される", async ({ page }) => {
  const names = [
    "マンドリル",
    "シロテテナガザル",
    "ワオキツネザル",
    "ヤギ・ヒツジ",
    "アジアゾウ",
    "フサオマキザル",
    "アカゲザル",
    "ニホンアナグマ",
    "シマウマ",
    "キリン",
    "カバ",
    "フェネック",
    "ニシゴリラ",
    "ロバ",
    "ミーアキャット",
    "ニホンジカ",
  ];
  for (const name of names) {
    await page.goto("./");
    await expect(page.locator(".animal-grid button")).toHaveCount(16);
    await page
      .locator(".animal-grid")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      name === "ヤギ・ヒツジ" ? "ヤギ" : name,
    );
    if (name !== "ヤギ・ヒツジ") {
      await expect(
        page.getByText("この課題の自動判定は未対応です。", { exact: false }),
      ).toBeVisible();
      await expect(page.getByTestId("canvas")).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("未対応課題は自分の描画を保持し、未確認情報と出典を明示する", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .locator(".animal-grid")
    .getByRole("button", { name: /マンドリル/ })
    .click();
  await expect(
    page.getByRole("button", { name: "描いた形を確かめる" }),
  ).toBeDisabled();
  await draw(page, rectangle);
  await page.getByRole("button", { name: "描いた形を確かめる" }).click();
  await expect(page.getByRole("status")).toContainText(
    "自動で正解とは判定していません",
  );
  const points = await page
    .locator(".sketch-preview polyline")
    .getAttribute("points");
  await expect(page.getByTestId("answer-shape")).toHaveCount(0);
  await page.getByRole("button", { name: "線を描き足す" }).click();
  await expect(
    page.getByRole("button", { name: "描いた形を確かめる" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "描いた形を確かめる" }).click();
  await expect(page.locator(".sketch-preview polyline")).toHaveAttribute(
    "points",
    points!,
  );
  await page.getByRole("button", { name: "分かっていることを見る" }).click();
  await expect(page.getByText("解説状態：", { exact: false })).toContainText(
    "未確認",
  );
  await expect(
    page.getByRole("link", { name: "京都市動物園の出典" }),
  ).toHaveAttribute("href", /m_sphinx/);
  await page.screenshot({
    path: `test-results/other-group-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("画像をローカルで読み込み、手動で選んだ動物の観察に使える", async ({
  page,
}) => {
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") uploads.push(request.url());
  });
  await page.goto("./");
  await page.getByRole("button", { name: "どうぶつをかざす" }).click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    canvas.getContext("2d")!.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "animal.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  await expect(
    page.getByRole("img", { name: "選択した観察写真" }),
  ).toBeVisible();
  await page
    .locator(".animal-grid")
    .getByRole("button", { name: /アジアゾウ/ })
    .click();
  await page.getByText("観察写真を見る", { exact: false }).click();
  await expect(
    page.getByRole("img", { name: "自分で選んだ観察用写真" }),
  ).toBeVisible();
  expect(uploads).toEqual([]);
});
