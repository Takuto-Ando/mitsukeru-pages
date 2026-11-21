import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { localShareRelay } from "./scripts/local-share-relay";
import { offlinePlugin } from "./scripts/offline-plugin";
import react from "@vitejs/plugin-react";
const legacy = process.env.VITE_LEGACY_EDITIONS === "1";

export default defineConfig(({ mode }) => ({
  cacheDir: `node_modules/.vite-${legacy ? "legacy" : mode}`,
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react({ jsxImportSource: "@zooketch/ruby" }),
    {
      name: "zooketch-shared-ruby-context",
      enforce: "post",
      config(config) {
        // React's plugin includes its JSX source in dependency optimization.
        // Keep our source wrapper in the app graph to share its React context.
        const deps = config.optimizeDeps;
        if (deps?.include)
          deps.include = deps.include.filter(
            (id) => !id.startsWith("@zooketch/ruby/"),
          );
      },
    },
    offlinePlugin(legacy),
    localShareRelay(),
  ],
  resolve: {
    alias: {
      "@zooketch/ruby": fileURLToPath(
        new URL("./src/furigana/runtime", import.meta.url),
      ),
    },
  },
  worker: { format: "es" },
  server: { host: "0.0.0.0", port: 5175, strictPort: true },
  preview: { host: "0.0.0.0", port: 4175, strictPort: true },
  build: {
    target: "safari16.4",
    rollupOptions: {
      input: {
        enhanced: fileURLToPath(new URL("./index.html", import.meta.url)),
        ...(legacy
          ? {
              dopa: fileURLToPath(
                new URL("./dopa/index.html", import.meta.url),
              ),
              replica: fileURLToPath(
                new URL("./replica/index.html", import.meta.url),
              ),
            }
          : {}),
      },
    },
  },
}));
