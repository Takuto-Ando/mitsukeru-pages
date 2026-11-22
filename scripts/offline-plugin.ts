import type { Plugin, ResolvedConfig } from "vite";
import { prepareCloudflareAssets } from "./cloudflare-assets";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { renderOfflineWorker } from "./offline-worker";
// Build-time precache. No remote resources, photographs, notebook or research data.
export function offlinePlugin(legacy = false): Plugin {
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
          [base + "figma/"]:
            base + (legacy ? "replica/index.html" : "index.html"),
          ...(!legacy && {
            [base + "dopa/"]: base + "index.html",
            [base + "replica/"]: base + "index.html",
          }),
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
        start_url: legacy ? base + "plus/" : base,
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
      const aliases = ["plus/", "replica/", "figma/", "dopa/"] as const;
      const entryFiles = new Set([
        "index.html",
        ...aliases.map((alias) => alias + "index.html"),
      ]);
      const manifests = new Set(["manifest.webmanifest"]);
      const enhancedHtml = await readFile(join(dir, "index.html"), "utf8");
      const documentFor = (html: string, manifestPath: string) =>
        html.replace(
          "</head>",
          `<link rel="manifest" href="${base}${manifestPath}"></head>`,
        );

      // Read all inputs before replacing them with their built HTML and manifest.
      const legacyHtml = new Map<string, string>();
      if (legacy) {
        for (const source of ["replica/", "dopa/"])
          legacyHtml.set(
            source,
            await readFile(join(dir, source, "index.html"), "utf8"),
          );
      }

      for (const alias of aliases) {
        await mkdir(join(dir, alias), { recursive: true });
        const source = alias === "figma/" ? "replica/" : alias;
        const alternateHtml = legacyHtml.get(source);
        let manifestFile = "manifest.webmanifest";
        if (alternateHtml) {
          manifestFile = alias + "manifest.webmanifest";
          const name =
            alias === "dopa/"
              ? "ズーケッチ ドパガキ版"
              : "ズーケッチ Figma再現版";
          await writeFile(
            join(dir, manifestFile),
            JSON.stringify({
              ...manifest,
              name,
              short_name: name,
              id: base + source,
              start_url: base + alias,
              scope: base + alias,
            }),
          );
          manifests.add(manifestFile);
        }
        await writeFile(
          join(dir, alias, "index.html"),
          documentFor(alternateHtml ?? enhancedHtml, manifestFile),
        );
      }
      await writeFile(
        join(dir, "index.html"),
        documentFor(enhancedHtml, "manifest.webmanifest"),
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
            name.startsWith("illustrations/kyoto/") ||
            name.startsWith("illustrations/simple/")
          )
            files.push(name);
        }
      }
      await scan(dir);
      files.sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(await readFile(join(dir, f)));
      const prefix = `zooketch-shell-${base}-`;
      const assetUrl = (file: string) =>
        base +
        (process.env.DEPLOY_TARGET === "cloudflare" && file.endsWith(".wasm.gz")
          ? file.slice(0, -3)
          : file);
      // The standard experience only starts YOLOX. The CLIP-specific worker
      // and its optional runtime must not consume bandwidth on first launch.
      const inferenceOnDemand = (file: string) =>
        !legacy &&
        /^assets\/(species\.worker-|ort-wasm-simd-threaded\.asyncify-)/.test(
          file,
        );
      const urls = files
        .filter((file) => !entryFiles.has(file) && !inferenceOnDemand(file))
        .map(assetUrl);
      const optionalUrls = files.filter(inferenceOnDemand).map(assetUrl);
      const documents: Record<string, string> = {};
      for (const file of entryFiles)
        documents[file] = await readFile(join(dir, file), "utf8");
      const render = (version: string) =>
        renderOfflineWorker({
          base,
          prefix,
          version,
          urls,
          optionalUrls,
          documents,
        });
      hash.update(render(""));
      await writeFile(
        join(dir, "sw.js"),
        render(hash.digest("hex").slice(0, 16)),
      );
    },
  };
}
