import { env, InferenceSession, Tensor } from "onnxruntime-web/wasm";
import wasm from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import runtime from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";
import { readPhotoModel } from "./photoModel";
import { classifyBioClip } from "./labels";
import type { SpeciesImageFit } from "./species";
import promptBank from "./bioclip-labels.json";

env.wasm.numThreads = 1;
env.wasm.proxy = false;
env.wasm.wasmPaths = { wasm, mjs: runtime };

const size = 224;
const planeSize = size ** 2;
const dimensions = 512;
const mean = [0.48145466, 0.4578275, 0.40821073];
const std = [0.26862954, 0.26130258, 0.27577711];
let classifier: ReturnType<typeof createClassifier> | undefined;

async function createClassifier() {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });
  if (!context) throw new Error("Species image context unavailable");
  context.imageSmoothingQuality = "high";

  const channels = new Float32Array(planeSize * 3);
  const quantized = Int8Array.from(atob(promptBank.vectors), (character) =>
    character.charCodeAt(0),
  );
  if (quantized.length !== promptBank.labels.length * dimensions)
    throw new Error("Invalid BioCLIP label vectors");
  const bank = promptBank.labels.map((label, row) => {
    const vector = quantized.subarray(row * dimensions, (row + 1) * dimensions);
    let squareSum = 0;
    for (const value of vector) squareSum += value ** 2;
    return { label, vector, norm: Math.sqrt(squareSum) };
  });
  const session = await InferenceSession.create(await readPhotoModel(), {
    executionProviders: ["wasm"],
  });

  const recognize = async (photo: string, fit: SpeciesImageFit = "crop") => {
    if (!photo.startsWith("data:image/")) throw new Error("No local photo");
    const image = await createImageBitmap(await (await fetch(photo)).blob());
    try {
      if (fit === "contain") {
        const scale = size / Math.max(image.width, image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.fillStyle = "#7b7568";
        context.fillRect(0, 0, size, size);
        context.drawImage(
          image,
          (size - width) / 2,
          (size - height) / 2,
          width,
          height,
        );
      } else {
        const side = Math.min(image.width, image.height);
        context.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size,
        );
      }
    } finally {
      image.close();
    }
    const { data } = context.getImageData(0, 0, size, size);
    for (let channel = 0; channel < mean.length; channel++) {
      const offset = channel * planeSize;
      for (let index = 0; index < planeSize; index++) {
        channels[offset + index] =
          (data[index * 4 + channel] / 255 - mean[channel]) / std[channel];
      }
    }

    const input = new Tensor("float32", channels, [1, 3, size, size]);
    try {
      const { embedding } = await session.run({ pixels: input });
      try {
        const features = embedding.data as Float32Array;
        return bank.map(({ label, vector, norm }) => {
          let dot = 0;
          for (let index = 0; index < dimensions; index++)
            dot += features[index] * vector[index];
          return { label, cosine: dot / norm };
        });
      } finally {
        embedding.dispose();
      }
    } finally {
      input.dispose();
    }
  };
  return { recognize, dispose: () => session.release() };
}

self.onmessage = async (
  event: MessageEvent<{ photo?: string; fit?: SpeciesImageFit }>,
) => {
  try {
    const { recognize } = await (classifier ??= createClassifier());
    if (!event.data.photo) {
      postMessage({ type: "result", result: { status: "ready" } });
      return;
    }
    postMessage({ type: "progress", text: "写真から候補を探しています…" });
    const { candidates, recognition } = classifyBioClip(
      await recognize(event.data.photo, event.data.fit),
    );
    postMessage({
      type: "result",
      result: candidates.length
        ? { status: "candidates", candidates, recognition }
        : {
            status: "unknown",
            recognition,
            reason:
              "はっきり識別できませんでした。下から動物を選んでください。",
          },
    });
  } catch (error) {
    console.warn(
      "Species model could not run:",
      error instanceof Error
        ? error.message.replace(/data:[^\s"]+/g, "[local-image]").slice(0, 240)
        : "runtime-error",
    );
    const failed = classifier;
    classifier = undefined;
    void failed?.then(({ dispose }) => dispose()).catch(() => {});
    postMessage({
      type: "result",
      result: {
        status: "unavailable",
        reason: navigator.onLine
          ? "モデルを利用できませんでした。通信・メモリ状況を確認するか、下から動物を選んでください。"
          : "オフラインAIの準備がありません。下から動物を選んでください。",
      },
    });
  }
};
