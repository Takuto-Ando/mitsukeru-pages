import type { Scene } from "../content/scenes";
export function drawingFocus(scene: Scene) {
  const height = scene.frameHeight || 400;
  const left = Math.min(...scene.regions.map((r) => r.x * 600));
  const right = Math.max(...scene.regions.map((r) => (r.x + r.width) * 600));
  const top = Math.min(...scene.regions.map((r) => r.y * height));
  const bottom = Math.max(
    ...scene.regions.map((r) => (r.y + r.height) * height),
  );
  const scale = Math.max(
    1,
    Math.min(
      3.2,
      (600 * 0.72) / (right - left),
      (height * 0.72) / (bottom - top),
    ),
  );
  return {
    scale,
    x: (300 - ((left + right) / 2) * scale) / 6,
    y: ((height / 2 - ((top + bottom) / 2) * scale) / height) * 100,
  };
}
