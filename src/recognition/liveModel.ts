import { trackDownloadedBytes, withDownloadDeadline } from "./download";

const version = "yolox-nano-coco-0.1.1rc0";
const cacheName = "zooketch-detection-" + version;
export const liveModelEvent = "zooketch:live-model-cached";
export const liveModelProgressEvent = "zooketch:live-model-progress";
export const liveModelBytes = 3_659_407;

function modelUrl() {
  return new URL(
    import.meta.env.BASE_URL + "models/" + version + ".onnx",
    self.location.origin,
  ).href;
}

export async function liveModelCached() {
  try {
    return Boolean(await (await caches.open(cacheName)).match(modelUrl()));
  } catch {
    return false;
  }
}

let downloading: Promise<void> | undefined;
let downloadedBytes = 0;

function updateProgress(bytes: number) {
  const previous = Math.floor((100 * downloadedBytes) / liveModelBytes);
  downloadedBytes = bytes;
  const current = Math.floor((100 * bytes) / liveModelBytes);
  if (current !== previous)
    window.dispatchEvent(new Event(liveModelProgressEvent));
}

export function liveModelDownloadedBytes() {
  return downloadedBytes;
}

export function downloadLiveModel() {
  return (downloading ??= withDownloadDeadline(60_000, async (signal) => {
    const cache = await caches.open(cacheName);
    const url = modelUrl();
    if (!(await cache.match(url))) {
      signal.throwIfAborted();
      updateProgress(0);
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("Detection model download failed");
      const bytes = await trackDownloadedBytes(response, (loaded) => {
        if (!signal.aborted) updateProgress(loaded);
      }).arrayBuffer();
      if (bytes.byteLength !== liveModelBytes)
        throw new Error("Unexpected detection model size");
      signal.throwIfAborted();
      await cache.put(
        url,
        new Response(bytes, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
      signal.throwIfAborted();
      if (!(await cache.match(url)))
        throw new Error("Detection model was not saved");
    }
    signal.throwIfAborted();
    updateProgress(liveModelBytes);
    window.dispatchEvent(new Event(liveModelEvent));
  }).finally(() => {
    downloading = undefined;
  }));
}

export async function readLiveModel() {
  const cache = await caches.open(cacheName);
  const url = modelUrl();
  const response = await cache.match(url);
  if (!response) throw new Error("Detection model has not been downloaded");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== liveModelBytes) {
    await cache.delete(url);
    throw new Error("Unexpected detection model size");
  }
  return bytes;
}
