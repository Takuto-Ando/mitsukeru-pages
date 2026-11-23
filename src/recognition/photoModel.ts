import { trackDownloadedBytes, withDownloadDeadline } from "./download";

import photoModel from "./bioclip-model.json";

export { photoModel };

export const photoModelEvent = "zooketch:photo-model-cached";
export const photoModelDownloadEvent = "zooketch:photo-model-download";
export const photoModelProgressEvent = "zooketch:photo-model-progress";

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
    return Boolean(
      await (await caches.open(photoModel.cache)).match(photoModel.url),
    );
  } catch {
    return false;
  }
}

async function storePhotoModel(
  onDownload?: () => void,
  onBytes?: (downloaded: number) => void,
) {
  const download = async () => {
    const cache = await caches.open(photoModel.cache);
    if (await cache.match(photoModel.url)) return;
    if (!navigator.onLine) throw new Error("No offline species model");
    onDownload?.();
    // Give a transfer on a slower connection time to finish without
    // discarding the response partway through and starting over.
    await withDownloadDeadline(300_000, async (signal) => {
      const response = await fetch(photoModel.url, { priority: "low", signal });
      if (
        !response.ok ||
        response.headers.get("Content-Type")?.includes("text/html")
      )
        throw new Error("Species model download failed");
      await cache.put(
        photoModel.url,
        onBytes ? trackDownloadedBytes(response, onBytes) : response,
      );
    });
  };
  return navigator.locks
    ? navigator.locks.request("zooketch-photo-model-download", download)
    : download();
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
  return (pending ??= storePhotoModel(() => {
    fetching = true;
    updateProgress(0);
    window.dispatchEvent(new Event(photoModelDownloadEvent));
  }, updateProgress)
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
  await storePhotoModel();
  const cache = await caches.open(photoModel.cache);
  const response = await cache.match(photoModel.url);
  if (!response) throw new Error("Species model cache miss");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== photoModel.bytes) {
    await cache.delete(photoModel.url);
    throw new Error("Unexpected species model size");
  }
  return bytes;
}
