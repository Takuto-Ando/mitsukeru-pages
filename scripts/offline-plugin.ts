import type { Plugin, ResolvedConfig } from "vite";
import { prepareCloudflareAssets } from "./cloudflare-assets";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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
    configureServer(server) {
      const base = server.config.base;
      server.middlewares.use((request, _response, next) => {
        const [path, search] = (request.url || "").split(/(?=\?)/, 2);
        const aliases: Record<string, string> = {
          [base + "plus/"]: base + "index.html",
          [base + "figma/"]: base + "replica/index.html",
        };
        const target = aliases[path.endsWith("/") ? path : path + "/"];
        if (target) request.url = target + (search || "");
        next();
      });
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
      const manifest = {
        id: base,
        name: "ズーケッチ",
        short_name: "ズーケッチ",
        lang: "ja",
        start_url: base + "plus/",
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
      const replicaBase = base + "replica/";
      const replicaManifest = {
        ...manifest,
        id: replicaBase,
        name: "ズーケッチ Figma再現版",
        short_name: "ズーケッチ Figma版",
        start_url: replicaBase,
        scope: replicaBase,
        background_color: "#fff9ef",
        theme_color: "#fff9ef",
      };
      await mkdir(join(dir, "figma"), { recursive: true });
      await mkdir(join(dir, "plus"), { recursive: true });
      await writeFile(
        join(dir, "replica", "manifest.webmanifest"),
        JSON.stringify(replicaManifest),
      );
      await writeFile(
        join(dir, "figma", "manifest.webmanifest"),
        JSON.stringify({
          ...replicaManifest,
          start_url: base + "figma/",
          scope: base + "figma/",
        }),
      );
      const dopaBase = base + "dopa/";
      await writeFile(
        join(dir, "dopa", "manifest.webmanifest"),
        JSON.stringify({
          ...manifest,
          id: dopaBase,
          name: "ズーケッチ ドパガキ版",
          short_name: "ズーケッチ ドパガキ版",
          start_url: dopaBase,
          scope: dopaBase,
          background_color: "#f7f2ff",
          theme_color: "#3d277e",
        }),
      );
      const entries = [
        ["", "", ""],
        ["plus/", "", ""],
        ["replica/", "replica/", "replica/"],
        ["figma/", "replica/", "figma/"],
        ["dopa/", "dopa/", "dopa/"],
      ] as const;
      const entryFiles = new Set(
        entries.map(([entry]) => entry + "index.html"),
      );
      const [enhancedHtml, replicaHtml, dopaHtml] = await Promise.all([
        readFile(join(dir, "index.html"), "utf8"),
        readFile(join(dir, "replica", "index.html"), "utf8"),
        readFile(join(dir, "dopa", "index.html"), "utf8"),
      ]);
      const documents = {
        "": enhancedHtml,
        "replica/": replicaHtml,
        "dopa/": dopaHtml,
      };
      for (const [entry, source, manifestPath] of entries) {
        const html = documents[source];
        await writeFile(
          join(dir, entry, "index.html"),
          html.replace(
            "</head>",
            `<link rel="manifest" href="${base}${manifestPath}manifest.webmanifest"></head>`,
          ),
        );
      }
      const manifests = new Set(
        entries.map(
          ([, , manifestPath]) => manifestPath + "manifest.webmanifest",
        ),
      );
      const files: string[] = [];
      async function scan(path: string) {
        for (const entry of await readdir(path, { withFileTypes: true })) {
          const full = join(path, entry.name),
            name = relative(dir, full).split("\\").join("/");
          if (entry.isDirectory()) await scan(full);
          else if (
            entryFiles.has(name) ||
            manifests.has(name) ||
            name === "icon.svg" ||
            name.startsWith("icons/") ||
            name.startsWith("assets/") ||
            name.startsWith("fonts/") ||
            name.startsWith("figma/entry/") ||
            name.startsWith("illustrations/pdf-design/") ||
            name.startsWith("replica-assets/") ||
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
      const edition=url.pathname.slice(BASE.length).split('/')[0];
      const entry=['figma','plus','replica','dopa'].includes(edition)?edition+'/index.html':'index.html';
      const cached=await (await caches.open(CACHE)).match(BASE+entry);
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
    },
  };
}
