import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// 1042758 measured 215642 bytes, 251.3 ms to title and 47.2 ms per YOLOX frame.
// The optimized build measured 169681 bytes, 218.0 ms and 42.7 ms.
// CLIP (q8, catalog labels) measured 9412 ms normally and 10068.7 ms constrained.
// Transfer has modest headroom. Timing allows for variances across CI hosts.
export const limits = [
  ["startup.transferBytes", 185_000, "bytes"],
  ["startup.titleMs", 1000, "ms"],
  ["yolox.inferenceMs", 200, "ms"],
  ["clip.normal.inferenceMs", 20_000, "ms"],
  ["clip.constrained.inferenceMs", 30_000, "ms"],
];

export function checkPerformanceBudget(report) {
  return limits.flatMap(([path, max, unit]) => {
    const value = path
      .split(".")
      .reduce((object, key) => object?.[key], report);
    if (!Number.isFinite(value) || value <= 0)
      return [`${path}: missing measurement`];
    if (value > max)
      return [`${path}: ${value} ${unit} exceeds ${max} ${unit}`];
    return [];
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2])
    throw Error(
      "Usage: node tools/recognition/performance-budget.mjs METRICS_JSON",
    );
  const report = JSON.parse(await readFile(process.argv[2], "utf8"));
  const failures = checkPerformanceBudget(report);
  if (failures.length) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
  } else {
    console.log("Performance budgets passed.");
  }
}
