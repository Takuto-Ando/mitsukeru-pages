import { expect, test } from "vitest";
import { checkPerformanceBudget } from "../../tools/recognition/performance-budget.mjs";

const metrics = {
  startup: { transferBytes: 175_000, titleMs: 400 },
  yolox: { inferenceMs: 50 },
  clip: { normal: { inferenceMs: 200 }, constrained: { inferenceMs: 500 } },
};

test("必要な測定結果がすべて予算内なら通る", () => {
  expect(checkPerformanceBudget(metrics)).toEqual([]);
});

test("超過と未計測をどちらも失敗として報告する", () => {
  const report = {
    ...metrics,
    startup: { ...metrics.startup, transferBytes: Number.MAX_SAFE_INTEGER },
    clip: { normal: { inferenceMs: 200 } },
  };
  expect(checkPerformanceBudget(report)).toEqual([
    expect.stringMatching(/^startup.transferBytes: .* exceeds /),
    "clip.constrained.inferenceMs: missing measurement",
  ]);
});
