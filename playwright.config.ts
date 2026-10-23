import { defineConfig } from "@playwright/test";
const preview = process.env.E2E_PREVIEW === "1";
const origin = preview ? "http://127.0.0.1:4175" : "http://127.0.0.1:5175";
const baseURL = origin + (process.env.E2E_BASE_PATH || "/");
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  },
  webServer: {
    command: preview
      ? "npm run preview -- --host 127.0.0.1"
      : "npm run dev -- --host 127.0.0.1",
    url: baseURL,
    reuseExistingServer: !preview,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "webkit",
      use: {
        browserName: "webkit",
        launchOptions: { executablePath: process.env.WEBKIT_EXECUTABLE_PATH },
      },
    },
  ],
});
