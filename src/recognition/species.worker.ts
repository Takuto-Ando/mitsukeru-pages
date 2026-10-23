import { pipeline, env } from "@huggingface/transformers";
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import runtimeUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";
import { animalLabels, rejectionLabels, chooseCandidates } from "./labels";
env.allowLocalModels = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.wasmPaths = { wasm: wasmUrl, mjs: runtimeUrl };
}
let classifier: Awaited<ReturnType<typeof createClassifier>> | undefined;
let lastProgress = 0;
async function createClassifier() {
  return pipeline(
    "zero-shot-image-classification",
    "Xenova/clip-vit-base-patch32",
    {
      revision: "d15189d7028b43f1d3e65039190477f6af591c2a",
      device: "wasm",
      dtype: "q8",
      progress_callback: (p) => {
        if (p.status === "progress" && Date.now() - lastProgress > 250) {
          lastProgress = Date.now();
          postMessage({
            type: "progress",
            text: `モデルを読込中 ${Math.round(p.progress)}%（ファイルごと）`,
          });
        }
      },
    },
  );
}
self.onmessage = async (event: MessageEvent<{ photo?: string }>) => {
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
        ? { status: "candidates", candidates }
        : {
            status: "unknown",
            reason:
              "はっきり識別できませんでした。下から動物を選んでください。",
          },
    });
  } catch {
    classifier = undefined;
    postMessage({
      type: "result",
      result: {
        status: "unavailable",
        reason:
          "モデルを利用できませんでした。通信・メモリ状況によって読み込めないことがあります。下から動物を選べます。",
      },
    });
  }
};
