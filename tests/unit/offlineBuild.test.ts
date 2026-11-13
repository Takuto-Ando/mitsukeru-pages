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
    ]) {
      const parent = file.slice(0, file.lastIndexOf("/"));
      if (parent) await mkdir(join(dir, parent), { recursive: true });
      await writeFile(join(dir, file), "fixture");
    }
    const plugin = offlinePlugin() as any;
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
    ])
      expect(worker).toContain(JSON.stringify("/zooketch/" + path));
    expect(worker).not.toContain("assets\\\\app.js");
    expect(
      JSON.parse(await readFile(join(dir, "manifest.webmanifest"), "utf8"))
        .start_url,
    ).toBe("/zooketch/");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
