import { useEffect, useRef, useState } from "react";
import { Pencil, Eraser, Undo2, RotateCcw } from "lucide-react";
import {
  drawingRegions,
  scenes,
  clipStrokes,
  scenePoint,
  type Scene,
} from "./content/scenes";
import { SceneBase } from "./components/ObservationScene";
import type { DrawingAction } from "./drawing/history";
import { TargetRegions } from "./components/TargetRegions";
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
  scene = scenes.goat,
  onDrawingActivity,
  onUndo,
  canUndo,
  showTarget = false,
}: {
  onDrawingActivity?: (active: boolean) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  showTarget?: boolean;
  template?: "eye" | "blank";
  backdrop?: React.ReactNode;
  scene?: Scene;
  strokes: Stroke[];
  onChange: (next: Stroke[], action: DrawingAction) => void;
}) {
  const frameHeight = scene.frameHeight || 400;
  const ref = useRef<HTMLCanvasElement>(null),
    active = useRef<number | null>(null),
    current = useRef<Stroke>([]);
  const [draft, setDraft] = useState<Stroke>([]),
    [erase, setErase] = useState(false);
  useEffect(
    () => () => {
      if (active.current !== null) onDrawingActivity?.(false);
    },
    [],
  );
  const paintFrame = useRef<number | undefined>(undefined);
  const paintState = useRef({ strokes, draft, scene });
  paintState.current = { strokes, draft, scene };
  useEffect(
    () => () => {
      if (paintFrame.current !== undefined)
        cancelAnimationFrame(paintFrame.current);
      paintFrame.current = undefined;
    },
    [],
  );
  useEffect(() => {
    if (paintFrame.current !== undefined) return;
    paintFrame.current = requestAnimationFrame(() => {
      paintFrame.current = undefined;
      const { strokes, draft, scene } = paintState.current;
      const canvas = ref.current;
      if (!canvas) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      if (
        canvas.width !== 600 * ratio ||
        canvas.height !== frameHeight * ratio
      ) {
        canvas.width = 600 * ratio;
        canvas.height = frameHeight * ratio;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, 600, frameHeight);
      context.save();
      context.beginPath();
      for (const r of drawingRegions(scene))
        context.rect(
          r.x * 600,
          r.y * frameHeight,
          r.width * 600,
          r.height * frameHeight,
        );
      context.clip();
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
      context.restore();
    });
  }, [strokes, draft, scene]);
  function point(event: { clientX: number; clientY: number }): Point {
    const rect = ref.current!.getBoundingClientRect();
    return scenePoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      frameHeight,
    );
  }

  function eraseAt(position: Point) {
    const next = strokes.filter(
      (stroke) =>
        !stroke.some(
          (end, index) =>
            index > 0 && segmentDistance(position, stroke[index - 1], end) < 23,
        ),
    );
    if (next.length !== strokes.length) onChange(next, "erase");
  }
  function cancel() {
    if (active.current !== null) onDrawingActivity?.(false);
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
      </div>
      <div
        className={"drawing-paper " + (draft.length ? "is-drawing" : "")}
        style={{ aspectRatio: `600 / ${frameHeight}` }}
      >
        <div
          className="scene-stage"
          data-testid="full-animal-stage"
          data-view="whole"
        >
          <svg
            className="eye-template"
            viewBox={`0 0 600 ${frameHeight}`}
            preserveAspectRatio="none"
            aria-label={scene.label + "を描き足すイラスト"}
            role="img"
          >
            <SceneBase scene={scene} />
            {(showTarget || (!strokes.length && !draft.length)) && (
              <TargetRegions scene={scene} />
            )}
          </svg>
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
              onDrawingActivity?.(true);
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
                const samples = event.nativeEvent.getCoalescedEvents?.() || [];
                current.current = [
                  ...current.current,
                  ...(samples.length ? samples.map(point) : [position]),
                ];
                setDraft(current.current);
              }
            }}
            onPointerUp={(event) => {
              if (active.current !== event.pointerId) return;
              if (!erase && current.current.length >= 1) {
                const next = [...current.current, point(event)];
                if (
                  next.length === 2 &&
                  next[0].x === next[1].x &&
                  next[0].y === next[1].y
                )
                  next[1] = {
                    ...next[1],
                    x: next[1].x + (next[1].x < 600 ? 0.01 : -0.01),
                  };
                if (clipStrokes([next], scene).length)
                  onChange([...strokes, next], "draw");
              }
              cancel();
            }}
            onPointerCancel={(event) => {
              if (active.current === event.pointerId) cancel();
            }}
            onLostPointerCapture={(event) => {
              if (active.current === event.pointerId) cancel();
            }}
          />
        </div>
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
          disabled={!(canUndo ?? !!strokes.length)}
          onClick={() =>
            onUndo ? onUndo() : onChange(strokes.slice(0, -1), "erase")
          }
        >
          <Undo2 size={19} />
          ひとつ戻す
        </button>
        <button
          disabled={!strokes.length}
          onClick={() => {
            onChange([], "clear");
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
