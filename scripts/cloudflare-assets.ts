import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

// HTTP compression only: browsers receive exactly the original WASM bytes.
// Keep every runtime fallback, model and recognition threshold unchanged.
export async function prepareCloudflareAssets(
  dir: string,
  limit = 25 * 1024 * 1024,
) {
  const headers = [
    "/sw.js\n  Cache-Control: no-cache\n",
    "/\n  Cache-Control: no-cache\n",
  ];
  const aliases: Record<string, string> = {};
  const compressed: {
    path: string;
    originalBytes: number;
    storedBytes: number;
  }[] = [];
  let count = 0;
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!entry.isFile())
        throw Error("Cloudflare公開データに通常ファイル以外が含まれています");
      count++;
      const bytes = await readFile(file);
      if (bytes.length <= limit) continue;
      const name = relative(dir, file).split("\\").join("/");
      if (!name.endsWith(".wasm"))
        throw Error(`Cloudflareのファイル制限を超えています: ${name}`);
      const gzip = gzipSync(bytes, { level: 9 });
      if (gzip.length > limit)
        throw Error(`圧縮後もCloudflareのファイル制限を超えています: ${name}`);
      if (!gunzipSync(gzip).equals(bytes))
        throw Error("WASM圧縮の検証に失敗しました");
      // Keep a .gz extension so the asset server does not gzip the stored
      // gzip stream a second time. Preserve the runtime URL with a 200 rewrite.
      await writeFile(file + ".gz", gzip);
      await unlink(file);
      aliases[`/${name}`] = `/${name}.gz`;
      for (const url of [name, name + ".gz"])
        headers.push(
          `/${url}\n  Content-Type: application/wasm\n  Content-Encoding: gzip\n  Cache-Control: public, max-age=31536000, immutable, no-transform\n`,
        );
      compressed.push({
        path: name,
        originalBytes: bytes.length,
        storedBytes: gzip.length,
      });
    }
  }
  await walk(dir);
  if (count + 5 > 20000)
    throw Error("Cloudflare無料プランのファイル数制限を超えています");
  await writeFile(join(dir, "_headers"), headers.join("\n"));
  await writeFile(
    join(dir, "_routes.json"),
    JSON.stringify({ version: 1, include: Object.keys(aliases), exclude: [] }),
  );
  await writeFile(
    join(dir, "_worker.js"),
    `
const aliases = ${JSON.stringify(aliases)};
export default {
  async fetch(request, env) {
    const url = new URL(request.url), assetPath = aliases[url.pathname];
    if (!assetPath) return env.ASSETS.fetch(request);
    url.pathname = assetPath;
    const asset = await env.ASSETS.fetch(new Request(url, request));
    if (!asset.ok) return asset;
    const headers = new Headers(asset.headers);
    headers.set("Content-Type", "application/wasm");
    headers.set("Content-Encoding", "gzip");
    headers.set("Cache-Control", "public, max-age=31536000, immutable, no-transform");
    headers.delete("Content-Length");
    // Stored bytes already contain gzip. Avoid a second automatic encoding.
    return new Response(asset.body, { status: asset.status, headers, encodeBody: "manual" });
  }
};
`,
  );
  return compressed;
}
