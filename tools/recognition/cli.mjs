import { readFile, writeFile } from "node:fs/promises";
import { loadDataset, registry, evaluate } from "./evaluation.mjs";
try {
  const [command, manifestPath, predictionsPath, outputPath] =
    process.argv.slice(2);
  if (command === "species") console.log(JSON.stringify(registry, null, 2));
  else if (command === "check" && manifestPath) {
    const dataset = await loadDataset(manifestPath);
    console.log(
      JSON.stringify(
        {
          samples: dataset.manifest.samples.length,
          counts: dataset.counts,
          missing: dataset.missing,
          ready: dataset.missing.length === 0,
        },
        null,
        2,
      ),
    );
    if (dataset.missing.length) process.exitCode = 2;
  } else if (
    command === "evaluate" &&
    manifestPath &&
    predictionsPath &&
    outputPath
  ) {
    const dataset = await loadDataset(manifestPath);
    const report = evaluate(
      dataset.manifest,
      JSON.parse(await readFile(predictionsPath, "utf8")),
    );
    await writeFile(outputPath, JSON.stringify(report, null, 2), {
      flag: "wx",
    });
    console.log(`評価結果を保存しました: ${outputPath}`);
  } else
    throw Error(
      "使い方: npm run recognition:lab -- species | check DATASET.json | evaluate DATASET.json PREDICTIONS.json NEW_REPORT.json",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
