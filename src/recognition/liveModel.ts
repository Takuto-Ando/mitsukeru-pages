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

export function downloadLiveModel({ replace = false } = {}) {
  return (downloading ??= (async () => {
    const cache = await caches.open(cacheName);
    const url = modelUrl();
    if (replace || !(await cache.match(url))) {
      updateProgress(0);
      const bytes = await withDownloadDeadline(60_000, async (signal) => {
        const response = await fetch(url, {
          cache: replace ? "reload" : "default",
          signal,
        });
        if (!response.ok) throw new Error("Detection model download failed");
        return trackDownloadedBytes(response, updateProgress).arrayBuffer();
      });
      if (bytes.byteLength !== liveModelBytes)
        throw new Error("Unexpected detection model size");
      await cache.put(
        url,
        new Response(bytes, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    }
    updateProgress(liveModelBytes);
    window.dispatchEvent(new Event(liveModelEvent));
  })().finally(() => {
    downloading = undefined;
  }));
}

export async function readLiveModel() {
  const response = await (await caches.open(cacheName)).match(modelUrl());
  if (!response) throw new Error("Detection model has not been downloaded");
  return response.arrayBuffer();
}
