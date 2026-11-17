import type { Point } from "../types";

// A light stabilizer: each new sample follows the raw pointer position by
// `follow` of the remaining distance, so small hand tremor is absorbed
// while the stroke still tracks the intended path. Rendering also smooths
// through midpoints (see SketchCanvas), this works on the stored points.
export function stabilizePoint(
  previous: Point,
  raw: Point,
  follow = 0.6,
): Point {
  return {
    x: previous.x + (raw.x - previous.x) * follow,
    y: previous.y + (raw.y - previous.y) * follow,
  };
}
