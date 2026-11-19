import type { Stroke, StrokeStyle } from "../types";

// Brush styles live outside the stroke point data so the evaluator and the
// saved point format stay unchanged. A WeakMap keyed by the stroke array
// itself carries the style through undo snapshots and clipping within a
// session; stylesFor/applyStyles convert to and from a serializable list
// for storage (observation records, drafts).
const registry = new WeakMap<Stroke, StrokeStyle>();

export function getStrokeStyle(stroke: Stroke): StrokeStyle | undefined {
  return registry.get(stroke);
}

export function setStrokeStyle(stroke: Stroke, style: StrokeStyle): void {
  registry.set(stroke, { ...style });
}

export function stylesFor(
  strokes: Stroke[],
): (StrokeStyle | null)[] {
  return strokes.map((stroke) => registry.get(stroke) ?? null);
}

export function applyStyles(
  strokes: Stroke[],
  styles?: readonly (StrokeStyle | null | undefined)[],
): void {
  if (!styles) return;
  strokes.forEach((stroke, index) => {
    const style = styles[index];
    if (style) registry.set(stroke, style);
  });
}
