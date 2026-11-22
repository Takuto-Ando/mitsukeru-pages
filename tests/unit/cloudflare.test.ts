import { test, expect, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { prepareCloudflareAssets } from "../../scripts/cloudflare-assets";
import { relayShare } from "../../scripts/cloudflare-share-worker.mjs";

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
    ).toEqual({
      version: 1,
      include: ["/assets/runtime.wasm", "/__zooketch-share"],
      exclude: [],
    });
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

test("YOLOXは同じバージョン付きURLで圧縮配信される", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zooketch-cloudflare-"));
  try {
    const model = Buffer.alloc(4096, 5);
    const path = "models/yolox-nano-coco-0.1.1rc0.onnx";
    await mkdir(join(dir, "models"));
    await writeFile(join(dir, path), model);
    const [compressed] = await prepareCloudflareAssets(dir);
    expect(compressed.storedBytes).toBeLessThan(model.length);
    expect(gunzipSync(await readFile(join(dir, path + ".gz")))).toEqual(model);
    const entry = JSON.parse(await readFile(join(dir, "_routes.json"), "utf8"));
    expect(entry.include).toContain("/" + path);
    expect(await readFile(join(dir, "_worker.js"), "utf8")).toContain(
      `"/${path}":{"path":"/${path}.gz","type":"application/octet-stream"}`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const shareEndpoint = "https://script.google.com/macros/s/test/exec";
const fakeToken = "worker-only";
const workerConfig = {
  ZOOKETCH_SHARE_ENDPOINT: shareEndpoint,
  ZOOKETCH_SHARE_TOKEN: fakeToken,
};
const fakeSketch = {
  id: "test-id",
  createdAt: "2026-11-21T12:00:00.000Z",
  animalName: "キリン",
  taskName: "舌",
  groupId: "giraffe",
  pngBase64: "iVBORAAA",
  strokes: [[{ x: 10, y: 20 }]],
};

function submission(
  body: unknown = fakeSketch,
  origin = "https://zooketch.pages.dev",
) {
  return new Request("https://zooketch.pages.dev/__zooketch-share", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
}

test("Drive中継は写真や埋め込まれた情報を除き、Workerだけが認証を添える", async () => {
  const upstream = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ ok: true, duplicated: true }));
  try {
    const response = await relayShare(
      submission(
        {
          ...fakeSketch,
          photo: "private-photo",
          token: "untrusted-client-token",
          profileId: "untrusted-profile",
          strokes: [[{ x: 10, y: 20, photo: "private-photo" }]],
        },
        "https://takuto-ando.github.io",
      ),
      workerConfig,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://takuto-ando.github.io",
    );
    expect(await response.text()).toBe("");
    expect(upstream.mock.calls[0][0]).toBe(shareEndpoint);
    expect(JSON.parse(upstream.mock.calls[0][1]!.body as string)).toEqual({
      ...fakeSketch,
      token: fakeToken,
    });
  } finally {
    upstream.mockRestore();
  }
});

test("Drive中継は不正なオリジン・内容を遮断し、受領失敗を200と扱わない", async () => {
  const upstream = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ ok: false }));
  try {
    const wrongOrigin = await relayShare(
      submission(fakeSketch, "https://other.example"),
      workerConfig,
    );
    expect(wrongOrigin.status).toBe(403);
    expect(wrongOrigin.headers.get("access-control-allow-origin")).toBeNull();
    expect((await relayShare(submission(), {})).status).toBe(503);
    expect(
      (
        await relayShare(
          submission({ ...fakeSketch, pngBase64: "bad" }),
          workerConfig,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await relayShare(
          submission({ ...fakeSketch, animalName: " =1+1" }),
          workerConfig,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await relayShare(
          submission({ ...fakeSketch, id: "../id" }),
          workerConfig,
        )
      ).status,
    ).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    expect((await relayShare(submission(), workerConfig)).status).toBe(502);
    expect(upstream).toHaveBeenCalledOnce();
  } finally {
    upstream.mockRestore();
  }
});
