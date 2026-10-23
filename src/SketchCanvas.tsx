import { useEffect, useRef, useState } from "react";
import { Pencil, Eraser, Undo2, RotateCcw } from "lucide-react";
import { Eye } from "./Illustrations";
import type { Point, Stroke } from "./types";

function segmentDistance(point: Point, start: Point, end: Point) {
  const length = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  const ratio = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - start.x) * (end.x - start.x) +
            (point.y - start.y) * (end.y - start.y)) /
            length,
        ),
      )
    : 0;
  return Math.hypot(
    point.x - start.x - ratio * (end.x - start.x),
    point.y - start.y - ratio * (end.y - start.y),
  );
}
export function SketchCanvas({
  strokes,
  onChange,
  template = "eye",
  backdrop,
}: {
  template?: "eye" | "blank";
  backdrop?: React.ReactNode;
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    active = useRef<number | null>(null),
    current = useRef<Stroke>([]);
  const [draft, setDraft] = useState<Stroke>([]),
    [erase, setErase] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = 600 * ratio;
    canvas.height = 400 * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 7;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#277e78";
    for (const stroke of [...strokes, draft]) {
      if (!stroke.length) continue;
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  }, [strokes, draft]);
  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(600, ((event.clientX - rect.left) * 600) / rect.width),
      ),
      y: Math.max(
        0,
        Math.min(400, ((event.clientY - rect.top) * 400) / rect.height),
      ),
    };
  }
  function eraseAt(position: Point) {
    onChange(
      strokes.filter(
        (stroke) =>
          !stroke.some(
            (end, index) =>
              index > 0 &&
              segmentDistance(position, stroke[index - 1], end) < 23,
          ),
      ),
    );
  }
  function cancel() {
    active.current = null;
    current.current = [];
    setDraft([]);
  }
  return (
    <div className="sketch-card">
      <div className="paper-top">
        <span>
          <i />
          かんさつスケッチ
        </span>
        <span>見えた部分を描こう</span>
      </div>
      <div className={"drawing-paper " + (draft.length ? "is-drawing" : "")}>
        {backdrop || (template === "eye" && <Eye />)}
        <canvas
          ref={ref}
          data-testid="canvas"
          aria-label="観察した形を描くキャンバス"
          onPointerDown={(event) => {
            if (
              active.current !== null ||
              !event.isPrimary ||
              event.button !== 0
            )
              return;
            event.preventDefault();
            active.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            const position = point(event);
            if (erase) eraseAt(position);
            else {
              current.current = [position];
              setDraft(current.current);
            }
          }}
          onPointerMove={(event) => {
            if (active.current !== event.pointerId) return;
            const position = point(event);
            if (erase) eraseAt(position);
            else {
              current.current = [...current.current, position];
              setDraft(current.current);
            }
          }}
          onPointerUp={(event) => {
            if (active.current !== event.pointerId) return;
            if (!erase && current.current.length > 1)
              onChange([...strokes, [...current.current, point(event)]]);
            cancel();
          }}
          onPointerCancel={(event) => {
            if (active.current === event.pointerId) cancel();
          }}
          onLostPointerCapture={(event) => {
            if (active.current === event.pointerId) cancel();
          }}
        />
        {!strokes.length && !draft.length && (
          <span className="paper-prompt">
            <Pencil size={15} />
            ここに、見えたかたちを。
          </span>
        )}
      </div>
      <div className="tools" aria-label="描画ツール">
        <button aria-pressed={!erase} onClick={() => setErase(false)}>
          <Pencil size={19} />
          ペン
        </button>
        <button aria-pressed={erase} onClick={() => setErase(true)}>
          <Eraser size={19} />
          消しゴム
        </button>
        <span />
        <button
          disabled={!strokes.length}
          onClick={() => onChange(strokes.slice(0, -1))}
        >
          <Undo2 size={19} />
          ひとつ戻す
        </button>
        <button
          disabled={!strokes.length}
          onClick={() => {
            onChange([]);
            setErase(false);
          }}
        >
          <RotateCcw size={19} />
          描き直す
        </button>
      </div>
      {erase && (
        <p className="eraser-tip">線にふれると、そのひと筆が消えるよ。</p>
      )}
    </div>
  );
}
