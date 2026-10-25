// Rasterize the existing SVG mark; no new artwork or external image dependency.
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const svg = await readFile("public/icon.svg", "utf8");
await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [size, path] of [
    [180, "public/icons/icon-180.png"],
    [192, "public/icons/icon-192.png"],
    [512, "public/icons/icon-512.png"],
  ]) {
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image();
        image.src =
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.fillStyle = "#2b8581";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    await writeFile(path, Buffer.from(data, "base64"));
  }
} finally {
  await browser.close();
}
