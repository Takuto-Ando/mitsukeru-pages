import { remoteWhileOffline } from "./cachePolicy";
import {
  CLIPModel,
  AutoTokenizer,
  AutoProcessor,
  ZeroShotImageClassificationPipeline,
  env,
} from "@huggingface/transformers";
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import runtimeUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";
import {
  animalLabels,
  rejectionLabels,
  chooseCandidates,
  recognitionFromOutput,
} from "./labels";
// v4 metadata probes ignore per-component revision. Pin the URL template too,
// so tokenizer/processor existence checks see the same cached revision.
env.remotePathTemplate =
  "{model}/resolve/d15189d7028b43f1d3e65039190477f6af591c2a/";
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
let classifier: Awaited<ReturnType<typeof createClassifier>> | undefined;
let lastProgress = 0;
async function createClassifier() {
  const modelId = "Xenova/clip-vit-base-patch32";
  const options = {
    revision: "d15189d7028b43f1d3e65039190477f6af591c2a",
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
  return new ZeroShotImageClassificationPipeline({
    task: "zero-shot-image-classification",
    model,
    tokenizer,
    processor,
  });
}

self.onmessage = async (
  event: MessageEvent<{ photo?: string; offline?: boolean }>,
) => {
  try {
    classifier ??= await createClassifier();
    if (!event.data.photo) {
      postMessage({ type: "result", result: { status: "ready" } });
      return;
    }
    postMessage({ type: "progress", text: "写真から候補を探しています…" });
    const output = await classifier(
      event.data.photo,
      [...animalLabels.map(([, label]) => label), ...rejectionLabels],
      { hypothesis_template: "This is a photo of {}." },
    );
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
