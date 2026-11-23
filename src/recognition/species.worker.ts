import { photoModel } from "./photoModel";
import { remoteWhileOffline } from "./cachePolicy";
import {
  CLIPModel,
  AutoTokenizer,
  AutoProcessor,
  RawImage,
  load_image,
  softmax,
  env,
} from "@huggingface/transformers";
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import runtimeUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";
import {
  speciesPrompts,
  rejectionLabels,
  chooseCandidates,
  recognitionFromOutput,
} from "./labels";
// v4 metadata probes ignore per-component revision. Pin the URL template too,
// so tokenizer/processor existence checks see the same cached revision.
env.remotePathTemplate = `{model}/resolve/${photoModel.revision}/`;
env.allowLocalModels = false;
env.useBrowserCache = true;
// Never attempt remote model fetches while offline. The runtime checks Cache API first.
const remoteFetch = env.fetch;
env.fetch = (input, init) => {
  if (
    remoteWhileOffline(String(input), self.location.origin, navigator.onLine)
  ) {
    // An optional processor file may legitimately be absent. A 404 lets the
    // library handle optional misses, while required uncached weights fail.
    return Promise.resolve(new Response(null, { status: 404 }));
  }
  return remoteFetch(input, init);
};
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.wasmPaths = { wasm: wasmUrl, mjs: runtimeUrl };
}
let classifier: ReturnType<typeof createClassifier> | undefined;
let lastProgress = 0;
const labels = [...speciesPrompts, ...rejectionLabels];

function dotAt(
  image: ArrayLike<number>,
  text: ArrayLike<number>,
  offset: number,
) {
  let sum = 0;
  for (let index = 0; index < image.length; index++)
    sum += image[index] * text[offset + index];
  return sum;
}

async function createClassifier() {
  const modelId = photoModel.id;
  const options = {
    revision: photoModel.revision,
    device: "wasm" as const,
    dtype: "q8" as const,
    progress_callback: (p: { status: string; progress?: number }) => {
      if (p.status === "progress" && Date.now() - lastProgress > 250) {
        lastProgress = Date.now();
        postMessage({
          type: "progress",
          text: `モデルを読込中 ${Math.round(p.progress || 0)}%（ファイルごと）`,
        });
      }
    },
  };
  // Explicit pinned components: v4 pipeline() probes metadata at main and may
  // omit a cached tokenizer while offline. Never infer required components from network availability.
  const [model, tokenizer, processor] = await Promise.all([
    CLIPModel.from_pretrained(modelId, options),
    AutoTokenizer.from_pretrained(modelId, options),
    AutoProcessor.from_pretrained(modelId, options),
  ]);
  const prompt = (name: string) => `This is a photo of ${name}.`;
  const textOptions = { padding: true, truncation: true } as const;
  const allText = tokenizer(labels.map(prompt), textOptions);
  // CLIP's text embeddings do not depend on the photo. Compute them once
  // before the first frame, using the same pinned model and label prompts.
  const blank = new RawImage(new Uint8Array(224 * 224 * 3), 224, 224, 3);
  const warm = await model({
    ...allText,
    pixel_values: (await processor(blank)).pixel_values,
  });
  const textEmbeds = warm.text_embeds.data;
  const warmImage = warm.image_embeds.data;
  const warmLogits = warm.logits_per_image.data;
  const dots = labels.map((_, index) =>
    dotAt(warmImage, textEmbeds, index * warmImage.length),
  );
  const norm = dots.reduce((sum, dot) => sum + dot ** 2, 0);
  const scale =
    dots.reduce((sum, dot, index) => sum + dot * warmLogits[index], 0) / norm;
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error("CLIP logit scale could not be recovered");

  // This export takes image and text inputs together. One prompt is enough
  // to obtain the image embedding without encoding the whole catalog again.
  const singleText = tokenizer([prompt(labels[0])], textOptions);
  return async (photo: string) => {
    const { pixel_values } = await processor(await load_image(photo));
    const result = await model({ ...singleText, pixel_values });
    const image = result.image_embeds.data;
    const scores = softmax(
      labels.map(
        (_, index) => scale * dotAt(image, textEmbeds, index * image.length),
      ),
    );
    return labels.map((label, index) => ({ label, score: scores[index] }));
  };
}

self.onmessage = async (
  event: MessageEvent<{ photo?: string; offline?: boolean }>,
) => {
  try {
    const ready = await (classifier ??= createClassifier());
    if (!event.data.photo) {
      postMessage({ type: "result", result: { status: "ready" } });
      return;
    }
    postMessage({ type: "progress", text: "写真から候補を探しています…" });
    const output = await ready(event.data.photo);
    const candidates = chooseCandidates(output);
    postMessage({
      type: "result",
      result: candidates.length
        ? {
            status: "candidates",
            candidates,
            recognition: recognitionFromOutput(output),
          }
        : {
            status: "unknown",
            recognition: recognitionFromOutput(output),
            reason:
              "はっきり識別できませんでした。下から動物を選んでください。",
          },
    });
  } catch (error) {
    console.warn(
      "Species model could not run:",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message
              .replace(/data:[^\s"]+/g, "[local-image]")
              .slice(0, 240),
            stack: error.stack?.split("\n").slice(1, 4).join("\n"),
          }
        : "runtime-error",
    );
    classifier = undefined;
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
