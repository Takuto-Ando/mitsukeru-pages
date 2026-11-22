import { test, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { offlinePlugin } from "../../scripts/offline-plugin";

test("各OSでネストされた素材を有効なURLとしてオフライン保存する", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zooketch-offline-"));
  try {
    for (const file of [
      "assets/app.js",
      "illustrations/whole/goat.svg",
      "fonts/gothic.woff2",
      "icons/icon-192.png",
      "index.html",
      "dopa/index.html",
      "replica/index.html",
      "replica-assets/sample.png",
    ]) {
      const parent = file.slice(0, file.lastIndexOf("/"));
      if (parent) await mkdir(join(dir, parent), { recursive: true });
      await writeFile(
        join(dir, file),
        file.endsWith(".html") ? "<html><head></head></html>" : "fixture",
      );
    }
    const plugin = offlinePlugin(true) as any;
    plugin.configResolved({
      command: "build",
      build: { outDir: dir },
      base: "/zooketch/",
    });
    await plugin.closeBundle();
    const worker = await readFile(join(dir, "sw.js"), "utf8");
    for (const path of [
      "assets/app.js",
      "illustrations/whole/goat.svg",
      "fonts/gothic.woff2",
      "icons/icon-192.png",
      "replica/manifest.webmanifest",
      "figma/manifest.webmanifest",
      "dopa/manifest.webmanifest",
      "replica-assets/sample.png",
    ])
      expect(worker).toContain(JSON.stringify("/zooketch/" + path));
    for (const path of [
      "index.html",
      "dopa/index.html",
      "replica/index.html",
      "figma/index.html",
      "plus/index.html",
    ]) {
      const html = await readFile(join(dir, path), "utf8");
      expect(worker).toContain(
        JSON.stringify(path) + ":" + JSON.stringify(html),
      );
    }
    expect(worker).not.toContain("assets\\\\app.js");
    expect(
      JSON.parse(await readFile(join(dir, "manifest.webmanifest"), "utf8"))
        .start_url,
    ).toBe("/zooketch/plus/");
    const replica = JSON.parse(
      await readFile(join(dir, "replica", "manifest.webmanifest"), "utf8"),
    );
    expect(replica).toMatchObject({
      id: "/zooketch/replica/",
      start_url: "/zooketch/replica/",
      scope: "/zooketch/replica/",
    });
    expect(
      await readFile(join(dir, "replica", "index.html"), "utf8"),
    ).toContain('href="/zooketch/replica/manifest.webmanifest"');
    expect(
      JSON.parse(
        await readFile(join(dir, "dopa", "manifest.webmanifest"), "utf8"),
      ),
    ).toMatchObject({
      id: "/zooketch/dopa/",
      start_url: "/zooketch/dopa/",
      scope: "/zooketch/dopa/",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("製品は旧URLでも同じオフラインページとマニフェストを使う", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zooketch-product-offline-"));
  try {
    await writeFile(
      join(dir, "index.html"),
      "<html><head></head><body>product</body></html>",
    );
    const plugin = offlinePlugin() as any;
    plugin.configResolved({
      command: "build",
      build: { outDir: dir },
      base: "/zooketch/",
    });
    await plugin.closeBundle();
    const primary = await readFile(join(dir, "index.html"), "utf8");
    for (const old of ["dopa", "figma", "plus", "replica"]) {
      expect(await readFile(join(dir, old, "index.html"), "utf8")).toBe(
        primary,
      );
      await expect(
        readFile(join(dir, old, "manifest.webmanifest"), "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
    expect(
      JSON.parse(await readFile(join(dir, "manifest.webmanifest"), "utf8"))
        .start_url,
    ).toBe("/zooketch/");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
