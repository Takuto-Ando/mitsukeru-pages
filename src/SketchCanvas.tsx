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
  onDrawingActivity?: (active: boolean, tool: "pen" | "eraser") => void;
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
  const activeTool = useRef<"pen" | "eraser">("pen");
  const ref = useRef<HTMLCanvasElement>(null),
    active = useRef<number | null>(null),
    current = useRef<Stroke>([]);
  const [drawing, setDrawing] = useState(false),
    [erase, setErase] = useState(false);
  const callbacks = useRef({ onChange, onDrawingActivity });
  callbacks.current = { onChange, onDrawingActivity };
  const working = useRef(strokes);
  const committed = useRef(strokes);
  committed.current = strokes;
  if (active.current === null) working.current = strokes;
  const paintFrame = useRef<number | undefined>(undefined);
  const paintState = useRef({ scene, frameHeight });
  paintState.current = { scene, frameHeight };
  function paint() {
    if (paintFrame.current !== undefined) return;
    paintFrame.current = requestAnimationFrame(() => {
      paintFrame.current = undefined;
      const { scene, frameHeight } = paintState.current;
      const canvas = ref.current;
      if (!canvas) return;
      // Allocate pixels for the displayed size, retaining logical 600-unit coordinates.
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.max(
        1,
        Math.round(canvas.getBoundingClientRect().width * ratio),
      );
      const height = Math.max(1, Math.round((width * frameHeight) / 600));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(width / 600, 0, 0, height / frameHeight, 0, 0);
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
      const draw = (stroke: Stroke) => {
        if (!stroke.length) return;
        context.beginPath();
        context.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++)
          context.lineTo(stroke[i].x, stroke[i].y);
        context.stroke();
      };
      for (const stroke of working.current) draw(stroke);
      draw(current.current);
      context.restore();
    });
  }
  useEffect(() => {
    paint();
  }, [strokes, scene]);
  useEffect(() => {
    const observer = new ResizeObserver(paint);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", paint);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", paint);
      if (paintFrame.current !== undefined)
        cancelAnimationFrame(paintFrame.current);
      paintFrame.current = undefined;
      if (active.current !== null)
        callbacks.current.onDrawingActivity?.(false, activeTool.current);
    };
  }, []);
  function point(
    event: { clientX: number; clientY: number },
    rect = ref.current!.getBoundingClientRect(),
  ): Point {
    return scenePoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width || 1,
      rect.height || 1,
      frameHeight,
    );
  }
  function append(position: Point) {
    const previous = current.current.at(-1);
    // Discard sub-pixel duplicates, without smoothing away the observed shape.
    if (
      !previous ||
      Math.hypot(position.x - previous.x, position.y - previous.y) >= 0.5
    )
      current.current.push(position);
  }
  function eraseAt(position: Point) {
    working.current = working.current.filter(
      (stroke) =>
        !stroke.some(
          (end, index) =>
            index > 0 && segmentDistance(position, stroke[index - 1], end) < 23,
        ),
    );
    paint();
  }
  function finish() {
    if (active.current === null) return;
    const pointerId = active.current;
    active.current = null;
    if (activeTool.current === "eraser") {
      if (working.current.length !== committed.current.length)
        callbacks.current.onChange(working.current, "erase");
    } else if (current.current.length) {
      const next = current.current;
      if (next.length === 1)
        next.push({
          ...next[0],
          x: next[0].x + (next[0].x < 600 ? 0.01 : -0.01),
        });
      if (clipStrokes([next], scene).length) {
        working.current = [...working.current, next];
        callbacks.current.onChange(working.current, "draw");
      }
    }
    current.current = [];
    setDrawing(false);
    callbacks.current.onDrawingActivity?.(false, activeTool.current);
    if (ref.current?.hasPointerCapture(pointerId))
      ref.current.releasePointerCapture(pointerId);
    paint();
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const hide = () => {
      if (document.hidden) finishRef.current();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  return (
    <div className="sketch-card">
      <div className="paper-top">
        <span>
          <i />
          かんさつスケッチ
        </span>
      </div>
      <div
        className={"drawing-paper " + (drawing ? "is-drawing" : "")}
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
            {(showTarget || (!strokes.length && !drawing)) && (
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
              activeTool.current = erase ? "eraser" : "pen";
              onDrawingActivity?.(true, activeTool.current);
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* The pointer may already have ended. */
              }
              const position = point(event);
              if (activeTool.current === "eraser") eraseAt(position);
              else {
                current.current = [position];
                setDrawing(true);
                paint();
              }
            }}
            onPointerMove={(event) => {
              if (active.current !== event.pointerId) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const samples = event.nativeEvent.getCoalescedEvents?.() || [];
              const events = samples.length ? samples : [event];
              for (const sample of events) {
                const position = point(sample, rect);
                if (activeTool.current === "eraser") eraseAt(position);
                else append(position);
              }
              paint();
            }}
            onPointerUp={(event) => {
              if (active.current !== event.pointerId) return;
              if (activeTool.current === "pen") append(point(event));
              finish();
            }}
            onPointerCancel={(event) => {
              if (active.current === event.pointerId) finish();
            }}
            onLostPointerCapture={(event) => {
              if (active.current === event.pointerId) finish();
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
