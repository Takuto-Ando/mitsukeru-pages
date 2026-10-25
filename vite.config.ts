import { defineConfig } from "vite";
import { offlinePlugin } from "./scripts/offline-plugin";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), offlinePlugin()],
  worker: { format: "es" },
  server: { host: "0.0.0.0", port: 5175, strictPort: true },
  preview: { host: "0.0.0.0", port: 4175, strictPort: true },
  build: { target: "safari16.4" },
});
