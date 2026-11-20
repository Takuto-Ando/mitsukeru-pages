import type { Scene } from "../content/scenes";

export type SceneViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: string;
};

// Card coordinates were measured from the supplied 402px design export.
// Convert into the legacy scene used by the SVG, drafts, strokes and exports.
const giraffeCard = {
  x: 326 + (13.09 - 180) * 1.36,
  y: 305 + (162.55 - 403) * 1.26,
  width: 375.96 * 1.36,
  height: 425.48 * 1.26,
  aspectRatio: "375.96 / 425.48",
};

export function designCardViewport(scene: Scene): SceneViewport | undefined {
  return scene.id === "giraffe" && scene.artworkOverride
    ? giraffeCard
    : undefined;
}
