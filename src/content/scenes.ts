import { profiles } from "./profiles";
import type { Point, Stroke } from "../types";
export type Region = { x: number; y: number; width: number; height: number };
export interface Scene {
  id: string;
  frameHeight?: number;
  artworkOverride?: import("./artwork").Artwork;
  label: string;
  regions: Region[];
  maskHoles?: Region[];
  background?: string;
  photo?: string;
  answerPath?: string;
  answerAsset?: string;
}
const boxes: Record<string, number[][]> = {
  goat: [[190, 165, 230, 110]],
  mandrill: [
    [170, 105, 80, 160],
    [350, 105, 80, 160],
  ],
  gibbon: [
    [85, 65, 185, 180],
    [330, 65, 180, 180],
  ],
  lemur: [
    [185, 125, 100, 115],
    [315, 125, 100, 115],
  ],
  elephant: [[245, 180, 140, 200]],
  capuchin: [[255, 110, 240, 260]],
  macaque: [
    [175, 140, 120, 150],
    [305, 140, 120, 150],
  ],
  badger: [
    [170, 100, 120, 210],
    [310, 100, 120, 210],
  ],
  zebra: [[180, 195, 240, 145]],
  giraffe: [[380, 215, 120, 140]],
  hippo: [
    [210, 155, 65, 55],
    [325, 155, 65, 55],
  ],
  fennec: [[185, 175, 230, 165]],
  gorilla: [[155, 45, 290, 145]],
  donkey: [
    [135, 205, 340, 40],
    [205, 125, 40, 200],
  ],
  meerkat: [
    [180, 140, 110, 85],
    [310, 140, 110, 85],
  ],
  deer: [[160, 155, 285, 125]],
};
export const scenes: Record<string, Scene> = Object.fromEntries(
  Object.entries(boxes).map(([id, rects]) => [
    id,
    {
      id,
      label: profiles[id]?.part || "ヤギの瞳孔",
      background: profiles[id]?.background,
      answerPath: profiles[id]?.answer,
      regions: rects.map(([x, y, width, height]) => ({
        x: x / 600,
        y: y / 400,
        width: width / 600,
        height: height / 400,
      })),
    },
  ]),
);
// Subtract protected landmarks (eyes) from editable regions using disjoint rectangles.
// SVG, Canvas, input validation and saved vectors use the same effective mask.
export function drawingRegions(scene: Scene): Region[] {
  let regions = scene.regions;
  for (const h of scene.maskHoles || [])
    regions = regions.flatMap((r) => {
      const x0 = Math.max(r.x, h.x),
        y0 = Math.max(r.y, h.y),
        x1 = Math.min(r.x + r.width, h.x + h.width),
        y1 = Math.min(r.y + r.height, h.y + h.height);
      if (x1 <= x0 || y1 <= y0) return [r];
      return [
        { x: r.x, y: r.y, width: r.width, height: y0 - r.y },
        { x: r.x, y: y1, width: r.width, height: r.y + r.height - y1 },
        { x: r.x, y: y0, width: x0 - r.x, height: y1 - y0 },
        { x: x1, y: y0, width: r.x + r.width - x1, height: y1 - y0 },
      ].filter((v) => v.width > 0 && v.height > 0);
    });
  return regions;
}
export function scenePoint(
  x: number,
  y: number,
  width: number,
  height: number,
  logicalHeight = 400,
): Point {
  return {
    x: Math.max(0, Math.min(1, x / width)) * 600,
    y: Math.max(0, Math.min(1, y / height)) * logicalHeight,
  };
}
// Clip segments, rather than clamping points: outside input cannot create a
// false connecting line, affect judging, or make an empty answer submittable.
export function clipStrokes(strokes: Stroke[], scene: Scene): Stroke[] {
  const frameHeight = scene.frameHeight || 400;
  const result: Stroke[] = [];
  for (const stroke of strokes)
    for (const r of drawingRegions(scene)) {
      let run: Stroke = [];
      const flush = () => {
        if (run.length > 1) result.push(run);
        run = [];
      };
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1],
          b = stroke[i],
          dx = b.x - a.x,
          dy = b.y - a.y;
        let lo = 0,
          hi = 1,
          valid = true;
        const ps = [-dx, dx, -dy, dy],
          qs = [
            a.x - r.x * 600,
            (r.x + r.width) * 600 - a.x,
            a.y - r.y * frameHeight,
            (r.y + r.height) * frameHeight - a.y,
          ];
        for (let j = 0; j < 4; j++) {
          if (ps[j] === 0) {
            if (qs[j] < 0) valid = false;
          } else {
            const t = qs[j] / ps[j];
            if (ps[j] < 0) lo = Math.max(lo, t);
            else hi = Math.min(hi, t);
          }
        }
        if (!valid || lo > hi) {
          flush();
          continue;
        }
        const start = { x: a.x + lo * dx, y: a.y + lo * dy },
          end = { x: a.x + hi * dx, y: a.y + hi * dy };
        if (
          run.length &&
          Math.hypot(run.at(-1)!.x - start.x, run.at(-1)!.y - start.y) > 0.01
        )
          flush();
        if (!run.length) run.push(start);
        run.push(end);
        if (hi < 1) flush();
      }
      flush();
    }
  return result;
}
