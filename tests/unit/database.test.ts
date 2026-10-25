import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("blocked open finishing after a retry closes its stale connection", async () => {
  const requests: Record<string, any>[] = [];
  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => {
      const request = {};
      requests.push(request);
      return request;
    }),
  });
  const { database } = await import("../../src/notebook/database");
  const first = database();
  const failure = expect(first).rejects.toThrow("別のタブ");
  requests[0].onblocked();
  await failure;
  const second = database();
  const stale = { close: vi.fn() };
  requests[0].result = stale;
  requests[0].onsuccess();
  expect(stale.close).toHaveBeenCalledOnce();
  const live = {
    close: vi.fn(),
    onclose: undefined as undefined | (() => void),
  };
  requests[1].result = live;
  requests[1].onsuccess();
  expect(await second).toBe(live);
  // Safari can force-close a database; the next operation must reopen it.
  live.onclose!();
  const third = database();
  expect(requests).toHaveLength(3);
  requests[2].result = { close: vi.fn() };
  requests[2].onsuccess();
  await third;
});

test("request and transaction failures are both handled by getAll", async () => {
  const request: Record<string, any> = {};
  const tx: Record<string, any> = {
    objectStore: () => ({ getAll: () => request }),
  };
  const open: Record<string, any> = {};
  vi.stubGlobal("indexedDB", { open: () => open });
  const { getAll } = await import("../../src/notebook/database");
  const operation = getAll("observations");
  const failure = expect(operation).rejects.toThrow("read failed");
  open.result = { transaction: () => tx };
  open.onsuccess();
  await vi.waitFor(() => expect(request.onerror).toBeTypeOf("function"));
  request.error = new Error("read failed");
  request.onerror();
  tx.error = new Error("transaction failed");
  tx.onabort();
  await failure;
});
