export const inputSize = 416;
export const animalLabels: Record<number, string> = {
  14: "鳥",
  15: "ネコの仲間",
  16: "イヌの仲間",
  17: "ウマの仲間",
  18: "ヒツジ",
  19: "ウシの仲間",
  20: "ゾウ",
  21: "クマ",
  22: "シマウマ",
  23: "キリン",
};

export type LiveBox = {
  label: string;
  score: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const immediateDetectionScore = 0.3;
const minimumDetectionScore = 0.15;

export function liveBoxOverlap(first: LiveBox, second: LiveBox) {
  const intersection =
    Math.max(
      0,
      Math.min(first.right, second.right) - Math.max(first.left, second.left),
    ) *
    Math.max(
      0,
      Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
    );
  const area = (box: LiveBox) =>
    (box.right - box.left) * (box.bottom - box.top);
  return intersection / (area(first) + area(second) - intersection);
}

export type TrackedLiveBox = LiveBox & { id: number };

export function confirmLiveBoxes(
  previous: readonly LiveBox[],
  boxes: readonly LiveBox[],
): LiveBox[] {
  return boxes.filter(
    (box) =>
      box.score >= immediateDetectionScore ||
      previous.some((candidate) => liveBoxOverlap(candidate, box) >= 0.45),
  );
}

export function trackLiveBoxes(
  previous: readonly TrackedLiveBox[],
  boxes: readonly LiveBox[],
  nextId: () => number,
): TrackedLiveBox[] {
  const unmatched = new Set(previous);
  return boxes.map((box) => {
    let best: TrackedLiveBox | undefined;
    let bestOverlap = 0.18;
    for (const candidate of unmatched) {
      const shared = liveBoxOverlap(candidate, box);
      if (candidate.label !== box.label && shared < 0.45) continue;
      if (shared > bestOverlap) {
        best = candidate;
        bestOverlap = shared;
      }
    }
    if (best) unmatched.delete(best);
    return { ...box, id: best?.id ?? nextId() };
  });
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function decodeLiveBoxes(
  data: Float32Array,
  width: number,
  height: number,
): LiveBox[] {
  const candidates: LiveBox[] = [];
  const channels = 85;
  let row = 0;
  for (const stride of [8, 16, 32]) {
    const cells = inputSize / stride;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++, row += channels) {
        const objectness = data[row + 4];
        if (objectness < minimumDetectionScore) continue;
        let category = 0;
        for (let index = 1; index < 80; index++)
          if (data[row + 5 + index] > data[row + 5 + category])
            category = index;
        const score = objectness * data[row + 5 + category];
        const label = animalLabels[category];
        if (!label || score < minimumDetectionScore) continue;
        const centerX = (data[row] + x) * stride;
        const centerY = (data[row + 1] + y) * stride;
        const halfWidth = (Math.exp(data[row + 2]) * stride) / 2;
        const halfHeight = (Math.exp(data[row + 3]) * stride) / 2;
        const box = {
          label,
          score,
          left: clamp((centerX - halfWidth) / width),
          top: clamp((centerY - halfHeight) / height),
          right: clamp((centerX + halfWidth) / width),
          bottom: clamp((centerY + halfHeight) / height),
        };
        if (box.right - box.left >= 0.03 && box.bottom - box.top >= 0.03)
          candidates.push(box);
      }
    }
  }
  const result: LiveBox[] = [];
  for (const box of candidates.sort((a, b) => b.score - a.score)) {
    if (result.some((prior) => liveBoxOverlap(prior, box) > 0.45)) continue;
    result.push(box);
    if (result.length === 3) break;
  }
  return result;
}

export function cameraWindow(
  width: number,
  height: number,
  aspect: number,
  zoom: number,
) {
  const cropWidth = Math.min(width, height * aspect) / zoom;
  const cropHeight = Math.min(height, width / aspect) / zoom;
  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
