import { afterEach, expect, test, vi } from "vitest";
import {
  canAutoDownloadPhotoModel,
  downloadPhotoModel,
  photoModel,
  photoModelCached,
  photoModelDownloading,
  photoModelEvent,
  readPhotoModel,
} from "../../src/recognition/photoModel";

afterEach(() => vi.unstubAllGlobals());
const origin = "https://zooketch.test";
const localKey = new URL(photoModel.cachePath, origin).href;

test.each([
  [{ onLine: false }, false],
  [{ onLine: true }, true],
  [{ onLine: true, connection: { saveData: true } }, false],
  [
    { onLine: true, connection: { type: "cellular", effectiveType: "4g" } },
    false,
  ],
  [{ onLine: true, connection: { type: "wifi", effectiveType: "3g" } }, false],
  [{ onLine: true, connection: { type: "wifi", effectiveType: "4g" } }, true],
])(
  "携帯回線・低速回線・節約モードでは大きなモデルを自動取得しない %j",
  (network, expected) => {
    vi.stubGlobal("navigator", network);
    expect(canAutoDownloadPhotoModel()).toBe(expected);
  },
);

function cacheStub() {
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (key: string) => entries.get(key)?.clone()),
    put: vi.fn(async (key: string, response: Response) => {
      // Model readiness must wait for CacheStorage to finish reading the body.
      await response.clone().arrayBuffer();
      entries.set(key, response);
    }),
    delete: vi.fn(async (key: string) => entries.delete(key)),
  };
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("location", { origin });
  return cache;
}

test("モデルの途中で画面が変わっても同じ取得を待ち、完了後はキャッシュを再利用する", async () => {
  const cache = cacheStub();
  const ready = vi.fn();
  window.addEventListener(photoModelEvent, ready);
  let completeBody!: () => void;
  const download = vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            completeBody = () => {
              controller.enqueue(new Uint8Array([1]));
              controller.close();
            };
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", download);
  const first = downloadPhotoModel();
  await vi.waitFor(() => expect(photoModelDownloading()).toBe(true));
  expect(await photoModelCached()).toBe(false);
  expect(downloadPhotoModel()).toBe(first);
  completeBody();
  await first;
  expect(photoModelDownloading()).toBe(false);
  expect(ready).toHaveBeenCalledTimes(1);
  expect(cache.put).toHaveBeenCalledTimes(1);
  expect(await photoModelCached()).toBe(true);
  await downloadPhotoModel();
  expect(download).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledWith(
    photoModel.url,
    expect.objectContaining({ priority: "low" }),
  );
});

test("エラーページは保存せず、読み込めないサイズのモデルは無効にする", async () => {
  const cache = cacheStub();
  const download = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("<html>Unavailable</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    )
    .mockResolvedValueOnce(new Response("Truncated model"));
  vi.stubGlobal("fetch", download);
  await expect(downloadPhotoModel()).rejects.toThrow(
    "Species model download failed",
  );
  expect(cache.put).not.toHaveBeenCalled();
  await expect(readPhotoModel()).rejects.toThrow(
    "Unexpected species model size",
  );
  expect(await photoModelCached()).toBe(false);
  expect(cache.delete).toHaveBeenCalledWith(localKey);
});

test("旧キャッシュを再利用し、明示的な再取得で同じオリジンの保存先に更新する", async () => {
  const cache = cacheStub();
  await cache.put(photoModel.url, new Response("old model"));
  const download = vi.fn(async () => new Response("updated model"));
  vi.stubGlobal("fetch", download);
  await downloadPhotoModel();
  expect(download).not.toHaveBeenCalled();
  await downloadPhotoModel({ replace: true });
  expect(download).toHaveBeenCalledWith(
    photoModel.url,
    expect.objectContaining({ cache: "reload" }),
  );
  expect(await (await cache.match(localKey))?.text()).toBe("updated model");
  expect(await cache.match(photoModel.url)).toBeUndefined();
});
