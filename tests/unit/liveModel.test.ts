import { afterEach, expect, test, vi } from "vitest";
import {
  downloadLiveModel,
  liveModelBytes,
  liveModelCached,
  liveModelEvent,
} from "../../src/recognition/liveModel";

afterEach(() => vi.unstubAllGlobals());

test("白枠モデルの保存が反映されなければダウンロード完了にしない", async () => {
  let cached = false;
  const cache = {
    match: vi.fn(async () => (cached ? new Response([]) : undefined)),
    put: vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        cached = true;
      }),
  };
  vi.stubGlobal("self", { location: { origin: "https://zooketch.test" } });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("caches", { open: async () => cache });
  const fetchModel = vi.fn(
    async () => new Response(new Uint8Array(liveModelBytes)),
  );
  vi.stubGlobal("fetch", fetchModel);
  const ready = vi.fn();
  window.addEventListener(liveModelEvent, ready);

  await expect(downloadLiveModel()).rejects.toThrow();
  expect(ready).not.toHaveBeenCalled();
  await expect(downloadLiveModel()).resolves.toBeUndefined();
  expect(await liveModelCached()).toBe(true);
  expect(fetchModel).toHaveBeenCalledTimes(2);
});
