import { adoptedAnimals } from "../../src/content/adoptedAnimals";
import { taskById } from "../../src/content/tasks";
import { expect, mockTutorialModels, test, type Page } from "./fixtures";

const galleryDatabase = "zooketch-figma-replica";

async function savedObservations(page: Page) {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<
        {
          id: string;
          photo?: string;
          groupId?: string;
          taskId?: string;
          photoLocation?: string;
          sketch?: string;
        }[]
      >((resolve, reject) => {
        const request = database
          .transaction("gallery")
          .objectStore("gallery")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }, galleryDatabase);
}

function button(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

async function useTestCamera(page: Page, completedTutorial: boolean) {
  await page.addInitScript((completed) => {
    if (completed) localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          document.documentElement.dataset.cameraRequested =
            JSON.stringify(constraints);
          return { getTracks: () => [track], getVideoTracks: () => [track] };
        },
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
  }, completedTutorial);
}

async function chooseAnimal(page: Page, name: string) {
  await button(page, "修正").click();
  await button(page, name).click();
}

async function drawGiraffeTongue(page: Page) {
  const canvas = page.getByTestId("canvas");
  await expect(canvas).toBeVisible();
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

test("写真確認の日付とカレンダーは長い動物名でも同じ位置に留まる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await useTestCamera(page, true);
  await page.goto("./");
  await button(page, "つづきから").click();
  await button(page, "シャッター").click();
  const savedHeading = page.getByRole("heading", {
    name: "写真をギャラリーに保存しました。",
  });
  await expect(savedHeading).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const savedText = savedHeading.locator(".replica-photo-saved-check + span");
  await expect(savedText).toHaveCSS("white-space", "nowrap");
  const headingBox = (await savedHeading.boundingBox())!;
  const savedTextBox = (await savedText.boundingBox())!;
  expect(savedTextBox.x + savedTextBox.width).toBeLessThanOrEqual(
    headingBox.x + headingBox.width + 1,
  );

  const metadata = page.locator(".design3-photo-date");
  const calendar = metadata.locator("img").first();
  const date = metadata.locator("time");
  const name = page.locator(".design3-photo-animal h2");
  await expect(date).toBeVisible();

  await chooseAnimal(page, "カバ");
  const fact = page.locator(".design3-photo-fact .zoo-card-summary-line");
  await expect(fact).toHaveText([
    "昼は水の中や水辺でゆっくり休みます。",
    "夜になると、陸に上がって草を食べます。",
  ]);
  const before = await Promise.all([
    calendar.boundingBox(),
    date.boundingBox(),
  ]);
  const shortSize = await name.evaluate((node) =>
    parseFloat(getComputedStyle(node).fontSize),
  );

  await button(page, "修正").click();
  const picker = page.locator(".replica-photo-picker");
  const pickerBox = (await picker.boundingBox())!;
  expect(pickerBox.width).toBeGreaterThan(240);
  expect(pickerBox.x).toBeGreaterThan(0);
  expect(pickerBox.x + pickerBox.width).toBeLessThan(320);
  const searchArea = picker.locator(":scope > :first-child");
  const search = searchArea.getByRole("searchbox", {
    name: "動物の名前で探す",
  });
  await expect(searchArea.locator("svg")).toBeVisible();
  const animals = picker.getByRole("list", { name: "動物の一覧" });
  await expect(animals.getByRole("button")).toHaveCount(30);
  await expect(
    animals.getByRole("button", { name: "フラミンゴ", exact: true }),
  ).toHaveCount(1);
  await expect(
    animals.getByRole("button", { name: "ヤギ・ヒツジ", exact: true }),
  ).toHaveCount(1);
  await search.fill("シマウマ");
  await expect(animals.getByRole("button")).toHaveCount(0);
  await search.fill("しろてて");
  await expect(picker.getByRole("button")).toHaveCount(1);
  await expect(button(page, "シロテテナガザル")).toHaveCSS(
    "font-weight",
    process.env.VITE_ADOBE_FONTS_KIT_ID ? "600" : "700",
  );
  await button(page, "シロテテナガザル").click();
  await expect(picker).toHaveCount(0);
  await expect(button(page, "修正")).toBeFocused();
  await expect(name).toHaveText("シロテテナガザル");
  const after = await Promise.all([calendar.boundingBox(), date.boundingBox()]);
  const positions = (boxes: typeof before) =>
    boxes.map((box) => box && { x: box.x, y: box.y });
  expect(positions(after)).toEqual(positions(before));
  const longSize = await name.evaluate((node) =>
    parseFloat(getComputedStyle(node).fontSize),
  );
  expect(longSize).toBeLessThan(shortSize);
  const nameBox = (await name.boundingBox())!;
  const editBox = (await button(page, "修正").boundingBox())!;
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(editBox.x);
  expect(editBox.x + editBox.width).toBeLessThanOrEqual(after[0]!.x);
});

test("写真は撮影直後に端末へ保存し、スケッチ完了時に同じ位置へ並べる", async ({
  page,
}) => {
  await useTestCamera(page, true);
  let uploads = 0;
  await page.route("https://script.google.com/macros/**", (route) => {
    uploads++;
    return route.abort();
  });
  const gallery = button(page, "ギャラリー");
  const openCamera = async () => {
    const start = button(page, "つづきから");
    await expect(start.or(gallery).first()).toBeVisible();
    if (await start.isVisible()) await start.click();
  };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  await openCamera();
  await button(page, "シャッター").click();
  const reviewImage = page.getByRole("img", { name: "撮影した動物の写真" });
  await expect(reviewImage).toBeVisible();
  await expect(reviewImage).toHaveCSS("aspect-ratio", "4 / 5");
  const photoCard = page.locator(".design3-photo-card");
  const cardAnimation = () =>
    photoCard.evaluate(
      (card) => getComputedStyle(card, "::after").animationName,
    );
  await expect.poll(cardAnimation).toBe("photo-card-shine");
  await expect(
    page.locator(".design3-photo-review .photo-sparkle"),
  ).toHaveCount(0);
  await expect(page.getByText(/きらりん/)).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(cardAnimation).toBe("none");
  await expect
    .poll(async () => (await savedObservations(page))[0]?.photo)
    .toMatch(/^data:image\/jpeg/);
  const savedHeading = page.getByRole("heading", {
    name: "写真をギャラリーに保存しました。",
  });
  await expect(savedHeading).toHaveCSS(
    "font-family",
    process.env.VITE_ADOBE_FONTS_KIT_ID
      ? /^"?dnp-shuei-mgothic-std"?[, ]/
      : /^"?Zen Maru Gothic"?[, ]/,
  );
  await expect(savedHeading).toHaveCSS(
    "font-weight",
    process.env.VITE_ADOBE_FONTS_KIT_ID ? "600" : "700",
  );
  const savedCheck = savedHeading.locator(".replica-photo-saved-check");
  await expect(savedCheck.locator("svg")).toBeVisible();
  await expect(savedCheck).toHaveCSS("border-top-width", "2px");
  await expect(savedCheck).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(
    savedHeading.locator('ruby[data-reading="ほぞん"]'),
  ).toBeVisible();
  const editButton = button(page, "修正");
  await expect(editButton.locator(".photo-review-edit-icon")).toBeVisible();
  const editBounds = (await editButton.boundingBox())!;
  expect(editBounds.width).toBeCloseTo(60, 0);
  expect(editBounds.height).toBeCloseTo(44, 0);
  await expect(
    button(page, "撮りなおす").locator(":scope > svg"),
  ).toBeVisible();
  await expect(
    button(page, "描いてもらう").locator(":scope > img"),
  ).toBeVisible();
  const jpeg = (await savedObservations(page))[0].photo!;
  const storedRatio = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    return image.naturalWidth / image.naturalHeight;
  }, jpeg);
  expect(storedRatio).toBe(4 / 5);

  await chooseAnimal(page, "キリン");
  await chooseAnimal(page, "カバ");
  await expect
    .poll(() => savedObservations(page))
    .toMatchObject([
      { groupId: "hippo", taskId: "hippo", photoLocation: "京都市動物園" },
    ]);
  expect((await savedObservations(page))[0].sketch).toBeUndefined();

  await page.reload();
  await openCamera();
  await gallery.click();
  const photos = page.getByRole("tab", { name: "写真", exact: true });
  await photos.click();
  await expect(button(page, "カバの写真を見る")).toHaveCount(0);

  await button(page, "写真を撮る").click();
  await button(page, "シャッター").click();
  await chooseAnimal(page, "キリン");
  await button(page, "描いてもらう").click();
  const preparation = page.locator("[data-screen=easel]");
  await expect(preparation).toHaveAttribute("data-figma-node", "43-1903");
  await expect
    .poll(() =>
      preparation
        .locator(".design3-intro-original")
        .evaluate((image) => (image as HTMLImageElement).currentSrc),
    )
    .toMatch(/\/figma\/entry\/loading\.svg$/);
  await expect(page.locator("[data-screen=challenge]")).toHaveAttribute(
    "data-figma-node",
    "66-8272",
  );
  await expect(page.getByRole("img", { name: /^難易度/ })).toBeVisible();
  await expect(button(page, "描きはじめる")).toHaveCount(0);
  await drawGiraffeTongue(page);
  await button(page, "できた！").click();
  const result = page.locator("[data-screen=result]");
  await expect(result.getByTestId("user-lines")).toBeVisible();
  await expect(result.getByRole("group", { name: "比較の表示" })).toHaveCount(
    0,
  );
  await expect(
    result.getByRole("button", { name: "描きなおす" }),
  ).toBeEnabled();
  await expect(
    result.getByRole("button", { name: "写真を撮る" }),
  ).toBeEnabled();
  await expect
    .poll(async () =>
      (await savedObservations(page)).find((item) => !!item.sketch),
    )
    .toMatchObject({
      groupId: "giraffe",
      taskId: "giraffe",
      sketch: /^data:image\/png/,
      photo: /^data:image\/jpeg/,
    });

  const completed = (await savedObservations(page)).find(
    (item) => item.sketch,
  )!;
  await page.evaluate(
    async ({ databaseName, sketch }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const write = database.transaction("gallery", "readwrite");
          write.objectStore("gallery").put({
            id: "sketch-only",
            createdAt: new Date(Date.now() + 60_000).toISOString(),
            groupId: "goat",
            taskId: "goat",
            animalName: "ヤギ",
            sketch,
          });
          write.oncomplete = () => resolve();
          write.onerror = () => reject(write.error);
        });
      } finally {
        database.close();
      }
    },
    { databaseName: galleryDatabase, sketch: completed.sketch },
  );

  await page.reload();
  await openCamera();
  await gallery.click();
  const slots = page.locator(".collection-grid [data-record-id]");
  const slotIds = () =>
    slots.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-record-id")),
    );
  const giraffeSketch = button(page, "キリンのスケッチを見る");
  await expect(giraffeSketch).toBeVisible();
  expect(await slotIds()).toEqual(["sketch-only", completed.id]);
  const tile = giraffeSketch.locator(".replica-sketch-image");
  const crop = await tile.evaluate((svg: SVGSVGElement) => {
    const { x, y, width, height } = svg.viewBox.baseVal;
    const image = svg.querySelector("image")!;
    return {
      x,
      y,
      right: x + width,
      bottom: y + height,
      imageWidth: image.width.baseVal.value,
      imageHeight: image.height.baseVal.value,
    };
  });
  expect(crop.x).toBeGreaterThanOrEqual(0);
  expect(crop.y).toBeGreaterThanOrEqual(0);
  expect(crop.right).toBeLessThanOrEqual(crop.imageWidth);
  expect(crop.bottom).toBeLessThanOrEqual(crop.imageHeight);
  await giraffeSketch.click();
  const sketchDetail = page.getByRole("dialog", { name: "キリンのスケッチ" });
  await expect(sketchDetail.locator(".gallery-detail-scroll")).toBeFocused();
  const closeSketch = sketchDetail.getByRole("button", { name: "一覧に戻る" });
  await expect(closeSketch).toHaveCSS("outline-style", "none");
  await closeSketch.focus();
  await expect(closeSketch).toBeFocused();
  await closeSketch.press("Shift");
  await expect(closeSketch).toHaveCSS("outline-color", "rgb(255, 255, 255)");
  await closeSketch.press("Enter");
  await expect(sketchDetail).toHaveCount(0);
  await photos.click();
  await expect(slots.first()).toHaveClass("gallery-slot");
  expect(await slotIds()).toEqual(["sketch-only", completed.id]);
  await expect(button(page, "カバの写真を見る")).toHaveCount(0);
  await button(page, "キリンの写真を見る").click();
  const detail = page.getByRole("dialog", {
    name: "キリンの写真",
    exact: true,
  });
  const detailImage = detail.getByRole("img", { name: "撮影した写真" });
  await expect(detailImage).toBeVisible();
  await expect(detailImage).toHaveCSS("aspect-ratio", "310 / 346");
  await expect(detail.getByRole("heading", { name: "キリン" })).toBeVisible();
  await expect(detail.locator("time")).toHaveAttribute("datetime", /^\d{4}-/);
  await expect(detail.getByText("京都市動物園", { exact: true })).toBeVisible();
  await expect(detail.locator(".replica-gallery-photo-fact")).not.toBeEmpty();
  expect(uploads).toBe(0);
});

test("チュートリアルで未検出なら撮影直後に動物を修正でき、写真を保存する", async ({
  page,
}) => {
  await mockTutorialModels(page);
  await useTestCamera(page, false);
  await page.goto("./");
  for (const name of [
    "はじめから",
    "決定！",
    "こんにちは！",
    "やってみる！",
    "撮ってみる！",
  ])
    await button(page, name).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-camera-requested",
    /"facingMode":{"ideal":"environment"}/,
  );
  await expect(button(page, "ギャラリー")).toBeDisabled();
  await button(page, "シャッター").click();
  await expect(
    page.getByRole("img", { name: "撮影した動物の写真", exact: true }),
  ).toBeVisible();
  await expect(button(page, "撮りなおす")).toBeEnabled();
  await expect(button(page, "修正")).toBeEnabled();
  await expect(button(page, "描いてもらう")).toBeDisabled();
  await expect(button(page, "描いてもらう")).toHaveCSS("opacity", "1");
  await expect(
    button(page, "描いてもらう").locator(".pitsune-cta-icon"),
  ).toHaveAttribute("src", /\/figma\/entry\/sketch-confirm\.svg$/);
  await expect(page.locator(".replica-recognition-status")).toHaveCount(0);
  await chooseAnimal(page, "キリン");
  await expect
    .poll(() => savedObservations(page))
    .toMatchObject([
      { groupId: "giraffe", taskId: "giraffe", photo: /^data:image\/jpeg/ },
    ]);
  await expect(page.locator("[data-screen=review]")).toBeVisible();
  await expect(button(page, "描いてもらう")).toBeEnabled();
});

test("撮影後の写真カードは全30組の説明を小型画面でも二行に収める", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 740 });
  await useTestCamera(page, true);
  await page.goto("./");
  await button(page, "つづきから").click();
  await button(page, "シャッター").click();
  const facts = page.locator(".design3-photo-fact .zoo-card-summary-line-text");
  for (const { name } of adoptedAnimals) {
    await chooseAnimal(page, name);
    await expect(facts, name).toHaveCount(2);
    await expect(facts.nth(0), name).toHaveText(/(?:です|ます)。$/);
    await expect(facts.nth(1), name).toHaveText(/(?:です|ます)。$/);
    await expect
      .poll(
        () =>
          facts.evaluateAll((lines) =>
            lines.flatMap((text) => {
              const overflow =
                text.getBoundingClientRect().right -
                text.parentElement!.getBoundingClientRect().right;
              const { whiteSpace } = getComputedStyle(text);
              return whiteSpace === "nowrap" && overflow <= 0.5
                ? []
                : [{ text: text.textContent, overflow, whiteSpace }];
            }),
          ),
        { message: name },
      )
      .toEqual([]);
  }
});

test("カメラ権限が得られなくても下部の追加ボタンを使わず動物選択へ進める", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("zooketch-replica-tutorial-v2", "1");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("./");
  await button(page, "つづきから").click();
  await expect(page.getByText(/シャッターで動物を選べます/)).toBeVisible();
  await expect(page.locator(".replica-camera-alternatives")).toHaveCount(0);
  await button(page, "シャッター").click();
  await expect(page.locator("[data-screen=review]")).toBeVisible();
  await expect(button(page, "描いてもらう")).toBeDisabled();
});
