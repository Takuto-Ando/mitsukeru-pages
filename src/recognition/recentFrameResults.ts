const retainedFrames = 4;

export function createRecentFrameResults<Result>() {
  const frames = new Map<number, { pixels: Uint32Array; result: Result }>();

  return {
    read(pixels: Uint32Array) {
      const key = sampledHash(pixels);
      const previous = frames.get(key);
      if (
        previous &&
        previous.pixels.length === pixels.length &&
        previous.pixels.every((pixel, index) => pixel === pixels[index])
      ) {
        frames.delete(key);
        frames.set(key, previous);
        return previous.result;
      }
    },
    write(pixels: Uint32Array, result: Result) {
      const key = sampledHash(pixels);
      frames.delete(key);
      frames.set(key, { pixels, result });
      if (frames.size > retainedFrames) {
        const oldest = frames.keys().next().value;
        if (oldest !== undefined) frames.delete(oldest);
      }
    },
  };
}

// Only a lookup hint. A hit still requires equality of every input pixel.
function sampledHash(pixels: Uint32Array) {
  let key = 2166136261;
  for (let index = 0; index < pixels.length; index += 181)
    key = Math.imul(key ^ pixels[index], 16777619);
  return key;
}
