import { withDownloadDeadline } from "./download";

export const photoModel = {
  id: "Xenova/clip-vit-base-patch32",
  revision: "d15189d7028b43f1d3e65039190477f6af591c2a",
};

const root = `https://huggingface.co/${photoModel.id}/resolve/${photoModel.revision}/`;
const files = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "preprocessor_config.json",
  "onnx/model_quantized.onnx",
];
const cacheName = "transformers-cache";
export const photoModelEvent = "zooketch:photo-model-cached";
export const photoModelDownloadEvent = "zooketch:photo-model-download";

export async function photoModelCached() {
  try {
    const cache = await caches.open(cacheName);
    return (
      await Promise.all(files.map((file) => cache.match(root + file)))
    ).every(Boolean);
  } catch {
    return false;
  }
}

let pending: Promise<void> | undefined;
let fetching = false;

export function photoModelDownloading() {
  return fetching;
}

export function photoDownloadInProgress() {
  return pending;
}

export function downloadPhotoModel() {
  const download = async () => {
    const cache = await caches.open(cacheName);
    for (const file of files) {
      const url = root + file;
      if (await cache.match(url)) continue;
      if (!fetching) {
        fetching = true;
        window.dispatchEvent(new Event(photoModelDownloadEvent));
      }
      await withDownloadDeadline(120_000, async (signal) => {
        const response = await fetch(url, { priority: "low", signal });
        if (!response.ok) throw new Error("Photo model download failed");
        await cache.put(url, response);
      });
    }
    window.dispatchEvent(new Event(photoModelEvent));
  };
  if (pending) return pending;
  pending = (
    navigator.locks
      ? navigator.locks.request("zooketch-photo-model-download", download)
      : download()
  ).finally(() => {
    pending = undefined;
    if (fetching) {
      fetching = false;
      window.dispatchEvent(new Event(photoModelDownloadEvent));
    }
  });
  return pending;
}
