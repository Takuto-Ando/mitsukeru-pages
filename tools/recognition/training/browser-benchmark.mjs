// Isolated localhost benchmark: never imported into the production bundle.
import { createServer } from "node:http";
import { readFile, stat, access, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium, webkit } from "@playwright/test";
const [directory, output, engine = "webkit"] = process.argv.slice(2);
let server, browser;
try {
  if (!directory || !output || !["webkit", "chromium"].includes(engine))
    throw Error(
      "Usage: node browser-benchmark.mjs MODEL_DIRECTORY NEW_REPORT.json [webkit|chromium]",
    );
  try {
    await access(output);
    throw Error("Output exists");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const dir = resolve(directory);
  let shape;
  try {
    shape = JSON.parse(
      await readFile(join(dir, "smoke-report.json"), "utf8"),
    ).inputSize;
  } catch {
    shape = JSON.parse(await readFile(join(dir, "metadata.json"), "utf8"))
      .preprocess.input_size;
  }
  if (
    !Array.isArray(shape) ||
    shape.length !== 3 ||
    shape[0] !== 3 ||
    shape.some((n) => !Number.isInteger(n) || n < 1 || n > 1024)
  )
    throw Error("Invalid input shape");
  const allowed = new Map();
  for (const name of [
    "ort.wasm.bundle.min.mjs",
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.wasm",
  ])
    allowed.set(
      "/ort/" + name,
      resolve("node_modules/onnxruntime-web/dist", name),
    );
  const models = [];
  for (const name of [
    "model.fp32.onnx",
    "model.int8.onnx",
    "model.weight-int8.onnx",
  ]) {
    const path = join(dir, name);
    let info;
    try {
      info = await stat(path);
    } catch (error) {
      if (name === "model.weight-int8.onnx" && error.code === "ENOENT")
        continue;
      throw error;
    }
    allowed.set("/" + name, path);
    models.push({ name, bytes: info.size });
  }
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>候補モデルのローカル検証</title><p>模擬入力による互換性・処理時間の確認。動物識別精度の試験ではありません。</p><script type="module">
import * as ort from '/ort/ort.wasm.bundle.min.mjs';
ort.env.wasm.numThreads=1; ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths={wasm:'/ort/ort-wasm-simd-threaded.wasm',mjs:'/ort/ort-wasm-simd-threaded.mjs'};
window.benchmark=async(name,shape)=>{
  const begin=performance.now();
  const session=await ort.InferenceSession.create('/'+name,{executionProviders:['wasm']});
  const prepareMs=performance.now()-begin;
  try {
    const data=new ort.Tensor('float32',new Float32Array(shape.reduce((a,b)=>a*b,1)),[1,...shape]);
    const times=[];
    for(let i=0;i<11;i++){
      const started=performance.now(), outputs=await session.run({pixel_values:data});
      times.push(performance.now()-started);
      const logits=outputs.logits;
      if(logits.data.length!==18||!Array.from(logits.data).every(Number.isFinite))throw Error('Invalid output');
      for(const tensor of Object.values(outputs)) tensor.dispose();
    }
    data.dispose();
    const warm=times.slice(1).sort((a,b)=>a-b);
    return{prepareMs,firstMs:times[0],warmMedianMs:(warm[4]+warm[5])/2,warmP95Ms:warm[9],runs:times.length};
  } finally { await session.release(); }
};
window.labReady=true;
</script></html>`;
  server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      if (path === "/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
      }
      const file = allowed.get(path);
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        path.endsWith(".mjs")
          ? "text/javascript"
          : path.endsWith(".wasm")
            ? "application/wasm"
            : "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  const page = await browser.newPage();
  // These local models and bundled runtime require no external network requests.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  await page.goto(origin);
  await page.waitForFunction(() => window.labReady);
  const artifacts = [];
  for (const model of models) {
    const result = await page.evaluate(
      async ({ name, shape }) => window.benchmark(name, shape),
      { name: model.name, shape },
    );
    artifacts.push({ ...model, ...result });
  }
  const report = {
    version: 1,
    kind: "synthetic-browser-compatibility-and-timing",
    animalAccuracyMeasured: false,
    environment: {
      engine,
      platform: process.platform,
      arch: process.arch,
      userAgent: await page.evaluate(() => navigator.userAgent),
      isPhysicalIPhone: false,
    },
    inputSize: shape,
    artifacts,
  };
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
