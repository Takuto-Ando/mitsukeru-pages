export const photoModel = {
  id: "Xenova/clip-vit-base-patch32",
  revision: "d15189d7028b43f1d3e65039190477f6af591c2a",
};

export async function photoModelCached() {
  try {
    const cache = await caches.open("transformers-cache");
    const root = `https://huggingface.co/${photoModel.id}/resolve/${photoModel.revision}/`;
    const files = [
      "config.json",
      "tokenizer.json",
      "preprocessor_config.json",
      "onnx/model_quantized.onnx",
    ];
    return (
      await Promise.all(files.map((file) => cache.match(root + file)))
    ).every(Boolean);
  } catch {
    return false;
  }
}
