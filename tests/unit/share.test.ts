import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueShare,
  loadShareConfig,
  pendingShareCount,
  saveShareConfig,
} from "../../src/future/share";

describe("絵の自動送信の設定とキュー", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
    vi.restoreAllMocks();
  });

  it("既定では同意OFFで送信先も空", () => {
    const config = loadShareConfig();
    expect(config.consent).toBe(false);
    expect(config.endpoint).toBe("");
  });

  it("設定を保存して読み直せる", () => {
    saveShareConfig({
      consent: true,
      endpoint: "https://script.google.com/macros/s/x/exec",
      token: "abc",
    });
    const config = loadShareConfig();
    expect(config.consent).toBe(true);
    expect(config.token).toBe("abc");
  });

  it("同意が無ければキューに入らない", () => {
    saveShareConfig({ consent: false, endpoint: "https://x", token: "" });
    enqueueShare("rec-1");
    expect(pendingShareCount()).toBe(0);
  });

  it("同意とURLがあればキューに入り、重複は入らない", () => {
    saveShareConfig({ consent: true, endpoint: "https://x", token: "t" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    Object.defineProperty(navigator, "onLine", { value: true });
    enqueueShare("rec-1");
    enqueueShare("rec-1");
    enqueueShare("rec-2");
    expect(pendingShareCount()).toBe(2);
  });
});
