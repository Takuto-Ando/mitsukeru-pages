import { env, InferenceSession, Tensor } from "onnxruntime-web/wasm";
import wasm from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import runtime from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";
import { decodeLiveBoxes, inputSize } from "./liveBoxes";
import { readLiveModel } from "./liveModel";

export type DetectionRequest =
  | { type: "prepare" }
  | { type: "frame"; pixels: ArrayBuffer; width: number; height: number };

env.wasm.numThreads = 1;
env.wasm.proxy = false;
env.wasm.wasmPaths = { wasm, mjs: runtime };
const planeSize = inputSize ** 2;
const channels = new Float32Array(planeSize * 3);
let session: InferenceSession;

self.onmessage = async ({ data }: MessageEvent<DetectionRequest>) => {
  try {
    if (data.type === "prepare") {
      session = await InferenceSession.create(await readLiveModel(), {
        executionProviders: ["wasm"],
      });
      postMessage({ type: "ready" });
      return;
    }
    const pixels = new Uint8ClampedArray(data.pixels);
    for (let index = 0, source = 0; index < planeSize; index++, source += 4) {
      channels[index] = pixels[source + 2];
      channels[index + planeSize] = pixels[source + 1];
      channels[index + 2 * planeSize] = pixels[source];
    }
    const input = new Tensor("float32", channels, [1, 3, inputSize, inputSize]);
    try {
      const output = await session.run({ images: input });
      try {
        const boxes = decodeLiveBoxes(
          output.output.data as Float32Array,
          data.width,
          data.height,
        );
        postMessage({ type: "boxes", boxes });
      } finally {
        for (const tensor of Object.values(output)) tensor.dispose();
      }
    } finally {
      input.dispose();
    }
  } catch {
    postMessage({ type: "error" });
  }
};
