/** Read-only capability inspection. No persistent-storage permission request. */
export interface StorageStatus {
  indexedDBAvailable: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  persisted?: boolean;
  estimateStatus: "available" | "unavailable";
}
export async function inspectStorage(): Promise<StorageStatus> {
  const result: StorageStatus = {
    indexedDBAvailable: typeof indexedDB !== "undefined",
    estimateStatus: "unavailable",
  };
  const storage =
    typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage) return result;
  await Promise.all([
    (async () => {
      try {
        const estimate = await storage.estimate?.();
        if (estimate) {
          if (
            typeof estimate.usage === "number" &&
            Number.isFinite(estimate.usage) &&
            estimate.usage >= 0
          )
            result.usageBytes = estimate.usage;
          if (
            typeof estimate.quota === "number" &&
            Number.isFinite(estimate.quota) &&
            estimate.quota >= 0
          )
            result.quotaBytes = estimate.quota;
          if (
            result.usageBytes !== undefined ||
            result.quotaBytes !== undefined
          )
            result.estimateStatus = "available";
        }
      } catch {
        /* Estimates are optional and not proof of successful writes. */
      }
    })(),
    (async () => {
      try {
        if (storage.persisted) result.persisted = await storage.persisted();
      } catch {
        /* Unknown, not false. */
      }
    })(),
  ]);
  return result;
}
export interface StorageProbeResult {
  writable: boolean;
  cleanup: "complete" | "pending" | "not-needed";
  reason?: "unavailable" | "failed" | "timeout";
}
/** Explicit user action only. Writes one marker to a unique disposable database, then removes it. */
export async function probeStorage(
  timeoutMs = 3000,
): Promise<StorageProbeResult> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000)
    throw new Error("確認の待ち時間を確認してください。");
  if (typeof indexedDB === "undefined")
    return { writable: false, cleanup: "not-needed", reason: "unavailable" };
  const name = "zooketch-probe-" + crypto.randomUUID();
  let db: IDBDatabase | undefined;
  let finished = false;
  let timer: ReturnType<typeof setTimeout>;
  const result = await new Promise<Omit<StorageProbeResult, "cleanup">>(
    (resolve) => {
      const finish = (value: Omit<StorageProbeResult, "cleanup">) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(value);
      };
      timer = setTimeout(
        () => finish({ writable: false, reason: "timeout" }),
        timeoutMs,
      );
      try {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
          if (finished) {
            request.transaction?.abort();
            return;
          }
          request.result.createObjectStore("probe");
        };
        request.onerror = () => finish({ writable: false, reason: "failed" });
        request.onblocked = () => finish({ writable: false, reason: "failed" });
        request.onsuccess = () => {
          db = request.result;
          if (finished) {
            db.close();
            indexedDB.deleteDatabase(name);
            return;
          }
          try {
            db.onversionchange = () => db?.close();
            const tx = db.transaction("probe", "readwrite"),
              store = tx.objectStore("probe");
            let matches = false;
            store.put("ok", "test");
            const read = store.get("test");
            read.onsuccess = () => {
              matches = read.result === "ok";
            };
            tx.oncomplete = () =>
              finish(
                matches
                  ? { writable: true }
                  : { writable: false, reason: "failed" },
              );
            tx.onabort = tx.onerror = () =>
              finish({ writable: false, reason: "failed" });
          } catch {
            finish({ writable: false, reason: "failed" });
          }
        };
      } catch {
        finish({ writable: false, reason: "failed" });
      }
    },
  );
  db?.close();
  const cleanup = await new Promise<StorageProbeResult["cleanup"]>(
    (resolve) => {
      const timer = setTimeout(() => resolve("pending"), timeoutMs);
      const finish = (value: StorageProbeResult["cleanup"]) => {
        clearTimeout(timer);
        resolve(value);
      };
      try {
        const removal = indexedDB.deleteDatabase(name);
        removal.onsuccess = () => finish("complete");
        removal.onerror = removal.onblocked = () => finish("pending");
      } catch {
        finish("pending");
      }
    },
  );
  return { ...result, cleanup };
}
