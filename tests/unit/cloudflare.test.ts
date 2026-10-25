import { test, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { prepareCloudflareAssets } from "../../scripts/cloudflare-assets";

test("Cloudflare用の大きなWASMを同じURLで配信し、元バイト列を復元できる", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zooketch-cloudflare-"));
  try {
    await mkdir(join(dir, "assets"));
    const wasm = Buffer.alloc(4096, 7),
      small = Buffer.from("small asset");
    await writeFile(join(dir, "assets/runtime.wasm"), wasm);
    await writeFile(join(dir, "assets/keep.js"), small);
    const result = await prepareCloudflareAssets(dir, 256);
    expect(result).toHaveLength(1);
    expect(
      JSON.parse(await readFile(join(dir, "_routes.json"), "utf8")),
    ).toEqual({ version: 1, include: ["/assets/runtime.wasm"], exclude: [] });
    expect(await readFile(join(dir, "_worker.js"), "utf8")).toContain(
      'encodeBody: "manual"',
    );
    expect(result[0].storedBytes).toBeLessThanOrEqual(256);
    expect(
      gunzipSync(await readFile(join(dir, "assets/runtime.wasm.gz"))),
    ).toEqual(wasm);

    expect(await readFile(join(dir, "assets/keep.js"))).toEqual(small);
    expect(await readFile(join(dir, "_headers"), "utf8")).toContain(
      "/assets/runtime.wasm\n  Content-Type: application/wasm\n  Content-Encoding: gzip",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("圧縮対象でない大容量ファイルを黙って公開しない", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zooketch-cloudflare-"));
  try {
    await writeFile(join(dir, "large.bin"), Buffer.alloc(4096));
    await expect(prepareCloudflareAssets(dir, 256)).rejects.toThrow(
      /ファイル制限/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
