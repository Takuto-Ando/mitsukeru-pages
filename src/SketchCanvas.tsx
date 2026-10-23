import { motion, useReducedMotion } from "motion/react";
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
}: {
  onDrawingActivity?: (active: boolean) => void;
  template?: "eye" | "blank";
  backdrop?: React.ReactNode;
  scene?: Scene;
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
}) {
  const reduce = useReducedMotion();
  const [zoom, setZoom] = useState(false);
  const [moving, setMoving] = useState(false);
  const last = clipStrokes(strokes, scene).at(-1)?.at(-1);
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
  useEffect(() => {
    if (reduce) return;
    const timer = setTimeout(() => {
      if (active.current === null) {
        setMoving(true);
        setZoom(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [reduce]);
  const center = scene.regions.reduce(
    (sum, r) => ({
      x: sum.x + (r.x + r.width / 2) / scene.regions.length,
      y: sum.y + (r.y + r.height / 2) / scene.regions.length,
    }),
    { x: 0, y: 0 },
  );
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = 600 * ratio;
    canvas.height = 400 * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.beginPath();
    for (const r of drawingRegions(scene))
      context.rect(r.x * 600, r.y * 400, r.width * 600, r.height * 400);
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
  }, [strokes, draft, scene]);
  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return scenePoint(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
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
        <span>見えた部分を描こう</span>
      </div>
      <div className={"drawing-paper " + (draft.length ? "is-drawing" : "")}>
        <motion.div
          className="scene-stage"
          initial={false}
          animate={{ scale: zoom ? 1.18 : 1 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: "easeInOut" }}
          style={{ transformOrigin: `${center.x * 100}% ${center.y * 100}%` }}
          onAnimationComplete={() => setMoving(false)}
        >
          <svg
            className="eye-template"
            viewBox="0 0 600 400"
            preserveAspectRatio="none"
            aria-label={scene.label + "を描き足すイラスト"}
            role="img"
          >
            <SceneBase scene={scene} />
          </svg>
          <canvas
            ref={ref}
            data-testid="canvas"
            aria-label="観察した形を描くキャンバス"
            onPointerDown={(event) => {
              if (
                moving ||
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
                current.current = [...current.current, position];
                setDraft(current.current);
              }
            }}
            onPointerUp={(event) => {
              if (active.current !== event.pointerId) return;
              if (!erase && current.current.length > 1) {
                const next = [...current.current, point(event)];
                if (clipStrokes([next], scene).length)
                  onChange([...strokes, next]);
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
          {!reduce && last && (
            <motion.span
              key={strokes.length}
              className="stroke-sparkle"
              style={{ left: `${last.x / 6}%`, top: `${last.y / 4}%` }}
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 1], y: -24 }}
              transition={{ duration: 0.65 }}
              aria-hidden="true"
            >
              ✦
            </motion.span>
          )}
          {!strokes.length && !draft.length && (
            <span className="paper-prompt">
              <Pencil size={15} />
              ここに、見えたかたちを。
            </span>
          )}
        </motion.div>
      </div>
      <button
        className="text-button zoom-toggle"
        aria-pressed={zoom}
        disabled={moving}
        onClick={() => {
          setMoving(!reduce);
          setZoom(!zoom);
        }}
      >
        {zoom ? "全体のイラストを見る" : "描く場所を大きく見る"}
      </button>
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
