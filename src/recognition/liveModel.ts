import { withDownloadDeadline } from "./download";

const version = "yolox-nano-coco-0.1.1rc0";
const cacheName = "zooketch-detection-" + version;
export const liveModelEvent = "zooketch:live-model-cached";

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

export function downloadLiveModel() {
  return (downloading ??= (async () => {
    const cache = await caches.open(cacheName);
    const url = modelUrl();
    if (!(await cache.match(url))) {
      const bytes = await withDownloadDeadline(60_000, async (signal) => {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error("Detection model download failed");
        return response.arrayBuffer();
      });
      if (bytes.byteLength !== 3_659_407)
        throw new Error("Unexpected detection model size");
      await cache.put(
        url,
        new Response(bytes, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    }
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
