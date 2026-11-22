import { once } from "node:events";
import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { renderOfflineWorker } from "../../scripts/offline-worker";

test("開いているタブで新旧の素材が混ざらず、閉じると新しい版になる", async ({
  context,
  page,
}) => {
  let release = "a";
  let omitScript = false;
  let serveOptional = false;
  const entry = (version: string) => `<!doctype html>
    <title>release ${version}</title>
    <link rel="icon" href="data:,">
    <div id="state"></div>
    <script src="/demo/app-${version}.js"></script>
    <script>navigator.serviceWorker.register("/demo/sw.js");</script>`;
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    response.setHeader("Cache-Control", "no-cache");
    if (path === "/demo/sw.js") {
      response.setHeader("Content-Type", "text/javascript");
      return response.end(
        renderOfflineWorker({
          base: "/demo/",
          prefix: "test-demo-",
          version: release,
          urls: [`/demo/app-${release}.js`, "/demo/animal.svg"],
          optionalUrls: ["/demo/optional.wasm"],
          documents: {
            "index.html": entry(release),
            "figma/index.html": entry(release),
          },
        }),
      );
    }
    if (!omitScript && path === `/demo/app-${release}.js`) {
      response.setHeader("Content-Type", "text/javascript");
      return response.end(`fetch("/demo/animal.svg").then(r => r.text()).then(animal => {
        document.getElementById("state").textContent = "${release}:" + animal;
      });`);
    }
    if (path === "/demo/animal.svg") return response.end(release);
    if (serveOptional && path === "/demo/optional.wasm") {
      response.setHeader("Content-Type", "application/wasm");
      return response.end(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    }
    response.setHeader("Content-Type", "text/html");
    response.end(entry(release));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (typeof address === "string" || !address) throw Error("No test port");
  const url = `http://127.0.0.1:${address.port}/demo/`;

  try {
    await page.goto(url);
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => undefined),
    );
    await page.reload();
    const controller = () =>
      page.evaluate(() => !!navigator.serviceWorker.controller);
    await expect.poll(controller).toBe(true);
    await expect(page.locator("#state")).toHaveText("a:a");

    const optionalRuntime = () =>
      page.evaluate(async () => {
        try {
          const response = await fetch("/demo/optional.wasm");
          return response.headers.get("Content-Type");
        } catch {
          return "failed";
        }
      });
    expect(await optionalRuntime()).toBe("failed");
    serveOptional = true;
    expect(await optionalRuntime()).toBe("application/wasm");

    // A missing JavaScript chunk can return a successful SPA fallback response.
    release = "b";
    omitScript = true;
    const failedInstall = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const installed = new Promise<string>((resolve) => {
        registration.addEventListener(
          "updatefound",
          () => {
            const worker = registration.installing!;
            worker.addEventListener("statechange", () => {
              if (worker.state === "redundant" || worker.state === "installed")
                resolve(worker.state);
            });
          },
          { once: true },
        );
      });
      await registration.update();
      return installed;
    });
    expect(failedInstall).toBe("redundant");
    await page.reload();
    await expect(page.locator("#state")).toHaveText("a:a");

    omitScript = false;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () => !!(await navigator.serviceWorker.ready).waiting,
        ),
      )
      .toBe(true);
    await page.evaluate(async () => {
      (await navigator.serviceWorker.ready).waiting?.postMessage(
        "activate-update",
      );
    });

    const otherTab = await context.newPage();
    await otherTab.goto(url + "figma/?demo=1");
    await expect(otherTab).toHaveTitle("release a");
    await expect(otherTab.locator("#state")).toHaveText("a:a");
    await context.setOffline(true);
    await otherTab.reload();
    await expect(otherTab.locator("#state")).toHaveText("a:a");
    await context.setOffline(false);
    await page.close();
    await otherTab.close();

    const newTab = await context.newPage();
    await expect(async () => {
      await newTab.goto(url);
      await expect(newTab.locator("#state")).toHaveText("b:b", {
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });
    await expect(newTab).toHaveTitle("release b");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
