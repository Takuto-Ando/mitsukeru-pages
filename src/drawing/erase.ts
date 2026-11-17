import type { Point, Stroke } from "../types";

// Partial erasing for the vector stroke model: the eraser removes only the
// parts of a stroke that fall inside its circle, splitting the stroke into
// the surviving runs. Strokes are subdivided first so that a fast, sparse
// stroke (few sampled points, long segments) erases as cleanly as a slow,
// dense one.

// Longest segment kept after subdivision, in scene units. Small compared to
// the eraser radius so the erased edge stays smooth.
const STEP = 3;

function subdivide(stroke: Stroke): Point[] {
  if (stroke.length < 2) return stroke.slice();
  const points: Point[] = [stroke[0]];
  for (let i = 1; i < stroke.length; i++) {
    const start = stroke[i - 1];
    const end = stroke[i];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(length / STEP));
    for (let s = 1; s <= steps; s++)
      points.push({
        x: start.x + ((end.x - start.x) * s) / steps,
        y: start.y + ((end.y - start.y) * s) / steps,
      });
  }
  return points;
}

function eraseStroke(
  stroke: Stroke,
  center: Point,
  radius: number,
): Stroke[] | null {
  // Quick reject: no point of the stroke can be inside the circle.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const point of stroke) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (
    center.x < minX - radius ||
    center.x > maxX + radius ||
    center.y < minY - radius ||
    center.y > maxY + radius
  )
    return null;
  const radiusSq = radius * radius;
  const inside = (point: Point) =>
    (point.x - center.x) ** 2 + (point.y - center.y) ** 2 < radiusSq;
  const points = subdivide(stroke);
  if (!points.some(inside)) return null;
  const parts: Stroke[] = [];
  let run: Point[] = [];
  const flush = () => {
    if (run.length === 1)
      // Keep a lone surviving point drawable as a dot, like the pen does.
      run.push({
        ...run[0],
        x: run[0].x + (run[0].x < 600 ? 0.01 : -0.01),
      });
    if (run.length > 1) parts.push(run);
    run = [];
  };
  for (const point of points) {
    if (inside(point)) flush();
    else run.push(point);
  }
  flush();
  return parts;
}

export function eraseStrokes(
  strokes: Stroke[],
  center: Point,
  radius: number,
  onSplit?: (original: Stroke, parts: Stroke[]) => void,
): { strokes: Stroke[]; changed: boolean } {
  let changed = false;
  const next: Stroke[] = [];
  for (const stroke of strokes) {
    const parts = stroke.length ? eraseStroke(stroke, center, radius) : null;
    if (parts === null) {
      next.push(stroke);
    } else {
      changed = true;
      onSplit?.(stroke, parts);
      next.push(...parts);
    }
  }
  return changed ? { strokes: next, changed } : { strokes, changed };
}
