import { trackDownloadedBytes, withDownloadDeadline } from "./download";

import photoModel from "./bioclip-model.json";

export { photoModel };

export const photoModelEvent = "zooketch:photo-model-cached";
export const photoModelDownloadEvent = "zooketch:photo-model-download";
export const photoModelProgressEvent = "zooketch:photo-model-progress";

function cacheKey() {
  return new URL(photoModel.cachePath, location.origin).href;
}

async function cachedModel(cache: Cache) {
  const key = cacheKey();
  const local = await cache.match(key);
  if (local) return { key, response: local };
  const legacy = await cache.match(photoModel.url);
  return legacy && { key: photoModel.url, response: legacy };
}

export function canAutoDownloadPhotoModel() {
  const { onLine, connection } = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      type?: string;
      effectiveType?: string;
    };
  };
  return (
    onLine &&
    !connection?.saveData &&
    connection?.type !== "cellular" &&
    !/2g|3g/.test(connection?.effectiveType ?? "")
  );
}

export async function photoModelCached() {
  try {
    return Boolean(await cachedModel(await caches.open(photoModel.cache)));
  } catch {
    return false;
  }
}

async function storePhotoModel({
  onDownload,
  onBytes,
}: {
  onDownload?: () => void;
  onBytes?: (downloaded: number) => void;
} = {}) {
  // Bound both the cross-tab lock and cache I/O. A stuck browser operation
  // must release the UI's in-flight download so another attempt is possible.
  return withDownloadDeadline(300_000, (signal) => {
    const download = async () => {
      const cache = await caches.open(photoModel.cache);
      if (await cachedModel(cache)) return;
      signal.throwIfAborted();
      if (!navigator.onLine) throw new Error("No offline species model");
      onDownload?.();
      const response = await fetch(photoModel.url, {
        priority: "low",
        signal,
      });
      if (
        !response.ok ||
        response.headers.get("Content-Type")?.includes("text/html")
      )
        throw new Error("Species model download failed");
      const body = onBytes
        ? trackDownloadedBytes(response, (bytes) => {
            if (!signal.aborted) onBytes(bytes);
          })
        : response;
      await cache.put(
        // WebKit can drop a cross-origin cache entry when its last tab closes
        // and then silently ignore writes to that same key after reopening.
        cacheKey(),
        body,
      );
      signal.throwIfAborted();
      if (!(await cache.match(cacheKey())))
        throw new Error("Species model was not saved");
      await cache.delete(photoModel.url).catch(() => undefined);
    };
    return navigator.locks
      ? navigator.locks.request(
          "zooketch-photo-model-download",
          { signal },
          download,
        )
      : download();
  });
}

let pending: Promise<void> | undefined;
let fetching = false;
let downloadedBytes = 0;

function updateProgress(bytes: number) {
  const previous = Math.floor((100 * downloadedBytes) / photoModel.bytes);
  downloadedBytes = bytes;
  const current = Math.floor((100 * bytes) / photoModel.bytes);
  if (current !== previous)
    window.dispatchEvent(new Event(photoModelProgressEvent));
}

export function photoModelDownloadedBytes() {
  return downloadedBytes;
}

export function photoModelDownloading() {
  return fetching;
}

export function photoDownloadInProgress() {
  return pending;
}

export function downloadPhotoModel() {
  return (pending ??= storePhotoModel({
    onDownload: () => {
      fetching = true;
      updateProgress(0);
      window.dispatchEvent(new Event(photoModelDownloadEvent));
    },
    onBytes: updateProgress,
  })
    .then(() => {
      updateProgress(photoModel.bytes);
      window.dispatchEvent(new Event(photoModelEvent));
    })
    .finally(() => {
      pending = undefined;
      if (fetching) {
        fetching = false;
        window.dispatchEvent(new Event(photoModelDownloadEvent));
      }
    }));
}

export async function readPhotoModel() {
  const cache = await caches.open(photoModel.cache);
  async function readCache() {
    let failure: unknown;
    for (const key of [cacheKey(), photoModel.url]) {
      const response = await cache.match(key);
      if (!response) continue;
      try {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength === photoModel.bytes) return bytes;
        await cache.delete(key);
        failure = new Error("Unexpected species model size");
      } catch (error) {
        // A cache read can fail temporarily. Try the other key without
        // deleting a response whose contents could not be checked.
        failure = error;
      }
    }
    if (failure) throw failure;
  }

  const cached = await readCache();
  if (cached) return cached;
  await storePhotoModel();
  const downloaded = await readCache();
  if (!downloaded) throw new Error("Species model cache miss");
  return downloaded;
}
