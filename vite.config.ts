import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { offlinePlugin } from "./scripts/offline-plugin";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react({ jsxImportSource: "@zooketch/ruby" }), offlinePlugin()],
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
        dopa: fileURLToPath(new URL("./dopa/index.html", import.meta.url)),
        replica: fileURLToPath(
          new URL("./replica/index.html", import.meta.url),
        ),
      },
    },
  },
});
