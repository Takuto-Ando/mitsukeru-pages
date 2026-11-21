import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@zooketch/ruby": fileURLToPath(
        new URL("./src/furigana/runtime", import.meta.url),
      ),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
