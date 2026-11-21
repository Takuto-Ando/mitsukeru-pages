import { sketchPresentationFor } from "../content/sketchPresentation";
import type { Scene } from "../content/scenes";

export type SceneViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: string;
};

export function designCardViewport(scene: Scene): SceneViewport | undefined {
  return sketchPresentationFor(scene)?.viewport;
}
