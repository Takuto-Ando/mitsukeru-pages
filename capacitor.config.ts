import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Development-only identifier. Set a unique owned ID before distribution.
  appId: "jp.mitsukerusketch.demo",
  appName: "ズーケッチ",
  webDir: "dist",
  ios: { contentInset: "never" },
  // No server.url: the demo bundles dist and works without the Mac dev server.
};

export default config;
