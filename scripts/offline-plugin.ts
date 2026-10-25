import type { Plugin, ResolvedConfig } from "vite";
import { prepareCloudflareAssets } from "./cloudflare-assets";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
// Build-time precache. No remote resources, photographs, notebook or research data.
export function offlinePlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "zooketch-offline",
    configResolved(value) {
      config = value;
    },
    async closeBundle() {
      if (config.command !== "build") return;
      const dir = config.build.outDir,
        base = config.base;
      if (process.env.DEPLOY_TARGET === "cloudflare") {
        if (base !== "/")
          throw Error("Cloudflare Pagesはルートbaseでビルドしてください");
        const compressed = await prepareCloudflareAssets(dir);
        for (const file of compressed)
          console.log(
            `Cloudflare HTTP gzip: ${file.path} ${file.originalBytes} → ${file.storedBytes} bytes`,
          );
      }
      const files: string[] = [];
      async function scan(path: string) {
        for (const entry of await readdir(path, { withFileTypes: true })) {
          const full = join(path, entry.name),
            name = relative(dir, full);
          if (entry.isDirectory()) await scan(full);
          else if (
            name === "index.html" ||
            name === "icon.svg" ||
            name.startsWith("icons/") ||
            name.startsWith("assets/") ||
            name.startsWith("fonts/") ||
            name.startsWith("illustrations/whole/") ||
            name.startsWith("illustrations/simple/")
          )
            files.push(name);
        }
      }
      await scan(dir);
      files.sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(await readFile(join(dir, f)));
      const version = hash.digest("hex").slice(0, 16);
      const prefix = `zooketch-shell-${base}-`;
      const urls = files.map(
        (f) =>
          base +
          (process.env.DEPLOY_TARGET === "cloudflare" && f.endsWith(".wasm.gz")
            ? f.slice(0, -3)
            : f),
      );
      const manifest = {
        id: base,
        name: "ズーケッチ",
        short_name: "ズーケッチ",
        lang: "ja",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#faf7ec",
        theme_color: "#277e78",
        icons: [
          {
            src: base + "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: base + "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: base + "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      };
      await writeFile(
        join(dir, "manifest.webmanifest"),
        JSON.stringify(manifest),
      );
      urls.push(base + "manifest.webmanifest");
      await writeFile(
        join(dir, "sw.js"),
        `
const PREFIX=${JSON.stringify(prefix)}, CACHE=PREFIX+${JSON.stringify(version)}, URLS=${JSON.stringify(urls)}, BASE=${JSON.stringify(base)};
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache = await caches.open(CACHE);
  try { await cache.addAll(URLS); }
  catch(error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  for(const name of await caches.keys()) if(name.startsWith(PREFIX)&&name!==CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if(event.data==='activate-update') self.skipWaiting();
  if(event.data==='offline-status') event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const ready=(await Promise.all(URLS.map(url=>cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready,version:${JSON.stringify(version)}});
  })());
});
self.addEventListener('fetch', event => {
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  if(request.mode==='navigate') {
    event.respondWith(fetch(request).catch(async()=>{
      const cached=await (await caches.open(CACHE)).match(BASE+'index.html');
      if(!cached)return Response.error();
      // Pages redirects /index.html to /. A cached redirected Response cannot
      // satisfy a navigation whose redirect mode is manual (Safari/Chromium).
      const headers=new Headers(cached.headers);
      headers.delete('Content-Encoding'); headers.delete('Content-Length');
      return new Response(cached.body,{status:200,headers});
    }));
  } else if(URLS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async c=>(await c.match(url.pathname))||fetch(request)));
  }
});
`,
      );
      const html = await readFile(join(dir, "index.html"), "utf8");
      await writeFile(
        join(dir, "index.html"),
        html.replace(
          "</head>",
          `<link rel="manifest" href="${base}manifest.webmanifest"><meta name="theme-color" content="#277e78"></head>`,
        ),
      );
    },
  };
}
