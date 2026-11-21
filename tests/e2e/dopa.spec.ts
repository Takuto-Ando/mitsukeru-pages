import { expect, test, type Page } from "@playwright/test";
import { taskById } from "../../src/content/tasks";

async function startGoat(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-tutorial-complete-v1", "true");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("denied", "NotAllowedError")),
      },
    });
  });
  await page.goto("dopa/");
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  await expect(
    page.locator('.dopa-progress [aria-current="step"]'),
  ).toContainText("撮影");
  await page.getByRole("button", { name: "写真なしで始める" }).click();
  await expect(page.locator(".dopa-snapshot")).toHaveCount(0);
  await page.getByRole("button", { name: "修正", exact: true }).click();
  await page.getByRole("button", { name: "ヤギ・ヒツジ", exact: true }).click();
  await page
    .getByRole("button", { name: "ピツネに見せる", exact: true })
    .click();
  await page.getByRole("button", { name: "描きはじめる", exact: true }).click();
}

async function drawPupil(page: Page) {
  const paper = page.locator(".drawing-paper");
  await paper.scrollIntoViewIfNeeded();
  const canvas = (await page.getByTestId("canvas").boundingBox())!;
  const region = taskById.goat.scene.regions[0];
  const x = region.x + region.width / 2;
  const y = region.y + region.height / 2;
  const rx = region.width * 0.36;
  const ry = region.height * 0.29;
  await page.mouse.move(
    canvas.x + (x + rx) * canvas.width,
    canvas.y + y * canvas.height,
  );
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const angle = (i * Math.PI) / 12;
    await page.mouse.move(
      canvas.x + (x + rx * Math.cos(angle)) * canvas.width,
      canvas.y + (y + ry * Math.sin(angle)) * canvas.height,
    );
  }
  await page.mouse.up();
}

test("ドパガキ版のXP表示と消音設定が再読み込み後も残る", async ({ page }) => {
  await page.goto("dopa/");
  await expect(page.locator(".dopa-bar")).toContainText("あと 40 XP");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "効果音 ON", exact: true }).click();
  await page.reload();
  await expect(page.locator(".dopa-bar")).toContainText("あと 40 XP");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "効果音 OFF", exact: true }),
  ).toBeVisible();
});

test("10筆で5 XP、合格で50 XP、新規保存で30 XPとレベルアップ", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("zooketch-dopa-xp-v1"))
      localStorage.setItem("zooketch-dopa-xp-v1", "100");
  });
  const xp = () =>
    page.evaluate(() => localStorage.getItem("zooketch-dopa-xp-v1"));
  await startGoat(page);
  await drawPupil(page);
  const canvas = (await page.getByTestId("canvas").boundingBox())!;
  const region = taskById.goat.scene.regions[0];
  const x = canvas.x + (region.x + region.width * 0.5) * canvas.width;
  const y = canvas.y + (region.y + region.height * 0.5) * canvas.height;
  for (let i = 0; i < 9; i++) await page.mouse.click(x, y);
  await expect(page.locator(".dopa-combo")).toContainText("10 コンボ！");
  await expect.poll(xp).toBe("105");
  await expect(page.locator(".dopa-combo")).toBeHidden({ timeout: 5500 });

  const answer = page.getByRole("button", { name: "できた！", exact: true });
  await answer.click();
  const jackpot = page.locator(".dopa-overlay[data-kind=jackpot]");
  await expect(jackpot).toContainText("大当たり！");
  await expect(jackpot).toHaveCSS("animation-name", "none");
  await expect(page.locator(".dopa-confetti-canvas")).toHaveCount(0);
  await expect(page.locator(".dopa-jackpot-banner")).toContainText("+50 XP");
  await expect(jackpot).toBeHidden();
  await expect.poll(xp).toBe("155");
  await page.getByRole("button", { name: "描きなおす", exact: true }).click();
  await answer.click();
  await expect(page.locator(".dopa-jackpot-banner")).toContainText("+50 XP");
  await expect(jackpot).toHaveCount(0);
  await expect.poll(xp).toBe("155");

  await page.getByRole("button", { name: /特徴について知ろう/ }).click();
  await page
    .getByRole("button", { name: "観察を保存する", exact: true })
    .click();
  const levelup = page.locator(".dopa-overlay[data-kind=levelup]");
  await expect(levelup).toContainText("Lv.3 到達！");
  await expect(levelup).toContainText("+30 XP");
  await expect.poll(xp).toBe("185");
  await page.reload();
  await expect(page.locator(".dopa-bar")).toContainText("Lv.3");
  await expect(page.locator(".dopa-bar")).toContainText("185 XP");
});

test("ホーム最下部の小さなリンクからドパガキ版を開き、拡張版へ戻れる", async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => {
    // The previous release saved a mode choice. Each URL now selects its own edition.
    const onDopaPage = location.pathname.endsWith("/dopa/");
    localStorage.setItem("zooketch-dopa-mode-v1", onDopaPage ? "0" : "1");
  });
  await page.goto("plus/");
  const footer = page.getByRole("navigation", { name: "版の切り替え" });
  const openDopa = footer.getByRole("link", { name: "ドパガキ版を開く" });
  const shell = page.locator(".design3-shell");
  await expect(page.locator(".dopa-title-art")).toHaveCount(0);
  await expect(shell).not.toHaveClass(/dopa-on/);
  await expect(page.locator(".design3-title > :last-child")).toHaveAttribute(
    "aria-label",
    "版の切り替え",
  );
  await expect(openDopa).toHaveCSS("font-size", "12px");
  expect((await openDopa.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await openDopa.click();
  await expect(page).toHaveURL(new URL("dopa/", baseURL!).href);
  await expect(page).toHaveTitle("ズーケッチ ドパガキ版");
  await expect(page.locator(".dopa-title-art img")).toBeVisible();
  await expect(shell).toHaveCSS("background-size", "300% 100%");
  await expect(
    page.getByRole("button", { name: /^ドパガキモード/ }),
  ).toHaveCount(0);
  for (const width of [320, 393, 430]) {
    await page.setViewportSize({ width, height: 852 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await footer.getByRole("link", { name: "機能拡張版を開く" }).click();
  await expect(page).toHaveURL(new URL("plus/", baseURL!).href);
  await expect(page.locator(".dopa-title-art")).toHaveCount(0);
  await expect(page.locator(".dopa-bar")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "ズーケッチのタイトル" }),
  ).toHaveCSS("background-color", "rgb(255, 250, 240)");
});

test("ピツネの反応・短い紙吹雪・解説と観察ノートが機能する", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await startGoat(page);
  await expect(
    page.locator('.dopa-progress [aria-current="step"]'),
  ).toContainText("描画");
  await drawPupil(page);
  await expect(page.getByText("いい線だね！", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "できた！", exact: true }).click();
  await expect(page.locator(".dopa-overlay[data-kind=jackpot]")).toContainText(
    "Lv.2 到達！",
  );
  await expect(page.locator(".dopa-confetti-canvas")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "大発見！", exact: true }),
  ).toBeVisible();
  const progress = page.locator('.dopa-progress [aria-current="step"]');
  await expect(progress).toContainText("答え合わせ");
  const confetti = page.getByTestId("dopa-confetti");
  await expect(confetti).toBeVisible();
  await expect(confetti.locator("i").first()).toHaveCSS(
    "animation-iteration-count",
    "1",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(confetti).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "大発見！", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /特徴について知ろう/ }).click();
  await expect(progress).toContainText("解説");
  await page
    .getByRole("button", { name: "観察を保存する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "保存したよ！", exact: true }),
  ).toBeDisabled();
  await page.goto("plus/");
  await page.getByRole("button", { name: /^図鑑を見る/ }).click();
  await expect(
    page.getByText("1枚の観察カードを保存しています。"),
  ).toBeVisible();
});

test("ドパガキ版をオフラインで再読み込みしても演出の版を保つ", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.E2E_PREVIEW !== "1",
    "サービスワーカーは公開用ビルドで確認",
  );
  await page.goto("dopa/");
  await expect(
    page.getByRole("button", { name: "はじめから", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 20_000,
    })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("ズーケッチ ドパガキ版");
  await expect(page.locator(".dopa-title-art img")).toBeVisible();
});

test("撮影したときだけスタンプが出て写真確認を続けられる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        }),
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      srcObject: { configurable: true, set() {}, get: () => null },
      videoWidth: { configurable: true, get: () => 640 },
      videoHeight: { configurable: true, get: () => 480 },
      play: { configurable: true, value: () => Promise.resolve() },
    });
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: any[]) {
      if (args[0] instanceof HTMLVideoElement) {
        this.fillStyle = "#87d9b8";
        this.fillRect(0, 0, 640, 480);
        return;
      }
      return (drawImage as any).apply(this, args);
    };
    window.Worker = class {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      terminate() {}
      postMessage() {
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              type: "result",
              result: { status: "unknown", reason: "動物を選んでね。" },
            },
          }),
        );
      }
    } as unknown as typeof Worker;
  });
  await page.goto("dopa/");
  await page.getByRole("button", { name: "はじめから", exact: true }).click();
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  const shutter = page.getByRole("button", { name: "シャッター", exact: true });
  await shutter.click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真" }),
  ).toHaveAttribute("src", /^data:image\/jpeg/);
  await expect(page.locator(".dopa-snapshot")).toHaveCSS(
    "animation-name",
    "dopa-snapshot",
  );
  await page.getByRole("button", { name: "もう一度撮る" }).click();
  await expect(page.locator(".dopa-snapshot")).toHaveCount(0);
  await expect(shutter).toBeEnabled();
});
