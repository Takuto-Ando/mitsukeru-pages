import type {
  Evaluation,
  Point,
  ShapeEvaluator,
  Stroke,
  ObservationParameters,
} from "./types";

const distance = (first: Point, second: Point) =>
  Math.hypot(first.x - second.x, first.y - second.y);
function sample(strokes: Stroke[]): Point[] {
  const points: Point[] = [];
  for (const stroke of strokes) {
    if (stroke[0]) points.push(stroke[0]);
    for (let index = 1; index < stroke.length; index++) {
      const before = stroke[index - 1],
        after = stroke[index];
      const steps = Math.max(1, Math.ceil(distance(before, after) / 3));
      for (let step = 1; step <= steps; step++)
        points.push({
          x: before.x + ((after.x - before.x) * step) / steps,
          y: before.y + ((after.y - before.y) * step) / steps,
        });
    }
  }
  return points;
}
export const geometryEvaluator: ShapeEvaluator = {
  evaluate(strokes, challenge) {
    return evaluateObservation(strokes, challenge.observationParameters);
  },
};

// Logical Canvas units (600 × 400). Tune here using observation fixtures.
export const observationParameters: ObservationParameters = {
  minAspect: 1.3,
  verticalAspect: 0.85,
  trim: 0.05,
  minHeight: 8,
  minWidth: 18,
};
export function evaluateObservation(
  strokes: Stroke[],
  parameters: ObservationParameters = observationParameters,
): Evaluation {
  // Fixed-distance samples prevent slow finger movement and repeated points
  // from dominating the quantiles. Duplicate spatial cells do not add weight.
  const cells = new Map<string, Point>();
  for (const p of sample(strokes)) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y))
      cells.set(`${Math.round(p.x / 3)},${Math.round(p.y / 3)}`, p);
  }
  const points = [...cells.values()];
  let measured = { width: 0, height: 0 };
  const result = (
    status: "correct" | "uncertain" | "retry",
    message: string,
    suggestion: string,
  ): Evaluation => ({
    status,
    passed: status === "correct",
    message,
    suggestion,
    debug: {
      cue: "horizontal",
      ...measured,
      strokes: strokes.length,
      automaticJudging: "horizontal-feature heuristic",
    },
  });
  if (!points.length)
    return result(
      "uncertain",
      "まだ描かれていないよ。",
      "見えた形を指で描いてみよう。",
    );
  const extent = (axis: "x" | "y") => {
    const values = points.map((p) => p[axis]).sort((a, b) => a - b);
    return (
      values[Math.floor((values.length - 1) * (1 - parameters.trim))] -
      values[Math.floor((values.length - 1) * parameters.trim)]
    );
  };
  const width = extent("x"),
    height = extent("y");
  measured = { width, height };
  if (width < parameters.minWidth && height < parameters.minWidth)
    return result(
      "uncertain",
      "小さな形が描けたね。横長に見えた？",
      "見えた特徴を教えてね。",
    );
  const aspect = width / Math.max(height, 1);
  if (aspect < parameters.verticalAspect)
    return result(
      "retry",
      "縦と横、どちらに長いかな？",
      "ヤギの目の黒いところを、もう一度見てみよう。",
    );
  if (aspect >= parameters.minAspect && height >= parameters.minHeight)
    return result("correct", "横長の特徴を見つけたね！", "");
  return result(
    "uncertain",
    "横長に見えた？",
    "線の形だけでは分からないので、見えた特徴を教えてね。",
  );
}
