import { useEffect, useRef, useState } from "react";
import { Pencil, Eraser, Undo2, Redo2, RotateCcw } from "lucide-react";
import {
  drawingRegions,
  scenes,
  clipStrokes,
  scenePoint,
  type Scene,
} from "./content/scenes";
import { SceneBase } from "./components/ObservationScene";
import type { DrawingAction } from "./drawing/history";
import { eraseStrokes } from "./drawing/erase";
import { stabilizePoint } from "./drawing/smooth";

const BRUSH_WIDTHS = [2.5, 4, 7, 11];
const BRUSH_COLORS = [
  "#9173ad",
  "#695b79",
  "#3a3238",
  "#8a6642",
  "#b0563a",
  "#277e78",
  "#8d8577",
];
import { TargetRegions } from "./components/TargetRegions";
import type { Point, Stroke } from "./types";

export function SketchCanvas({
  strokes,
  onChange,
  scene = scenes.goat,
  onDrawingActivity,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  missionTitle,
  hintControl,
  landscapeInstruction,
  landscapeComplete,
  landscapeReselect,
  showTarget = false,
}: {
  onDrawingActivity?: (active: boolean, tool: "pen" | "eraser") => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  missionTitle?: string;
  hintControl?: React.ReactNode;
  landscapeInstruction?: React.ReactNode;
  landscapeComplete?: React.ReactNode;
  landscapeReselect?: React.ReactNode;
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
    [erase, setErase] = useState(false),
    [brushWidth, setBrushWidth] = useState(7),
    [brushColor, setBrushColor] = useState(
      missionTitle ? "#9173ad" : "#277e78",
    );
  const [layoutChoice, setLayoutChoice] = useState<
    "portrait" | "landscape" | null
  >(null);
  const [autoLayout, setAutoLayout] = useState<"portrait" | "landscape">(() =>
    window.matchMedia("(min-width: 760px)").matches ? "landscape" : "portrait",
  );
  const layout = layoutChoice ?? autoLayout;
  useEffect(() => {
    const media = window.matchMedia("(min-width: 760px)");
    const update = () =>
      setAutoLayout(media.matches ? "landscape" : "portrait");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const brushStyles = useRef(
    new WeakMap<Stroke, { width: number; color: string }>(),
  );
  const activeBrush = useRef({ width: brushWidth, color: brushColor });
  const callbacks = useRef({ onChange, onDrawingActivity });
  callbacks.current = { onChange, onDrawingActivity };
  const working = useRef(strokes);
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
      context.lineCap = "round";
      context.lineJoin = "round";
      const draw = (stroke: Stroke, current = false) => {
        if (!stroke.length) return;
        const style = current
          ? activeBrush.current
          : brushStyles.current.get(stroke) || {
              width: 7,
              color: missionTitle ? "#9173ad" : "#277e78",
            };
        context.lineWidth = style.width;
        context.strokeStyle = style.color;
        context.beginPath();
        context.moveTo(stroke[0].x, stroke[0].y);
        if (stroke.length === 2) {
          context.lineTo(stroke[1].x, stroke[1].y);
        } else if (stroke.length > 2) {
          // Smooth through midpoints so fast strokes stay round instead of
          // polygonal; the stored points (and scoring) are unchanged.
          for (let i = 1; i < stroke.length - 1; i++)
            context.quadraticCurveTo(
              stroke[i].x,
              stroke[i].y,
              (stroke[i].x + stroke[i + 1].x) / 2,
              (stroke[i].y + stroke[i + 1].y) / 2,
            );
          const last = stroke[stroke.length - 1];
          context.lineTo(last.x, last.y);
        }
        context.stroke();
      };
      for (const stroke of working.current) draw(stroke);
      draw(current.current, true);
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
    if (!previous) {
      current.current.push(position);
      return;
    }
    // Stabilize against hand tremor, and discard sub-pixel duplicates
    // without smoothing away the observed shape.
    const smoothed = stabilizePoint(previous, position);
    if (
      Math.hypot(smoothed.x - previous.x, smoothed.y - previous.y) >= 0.5
    )
      current.current.push(smoothed);
  }
  const lastErase = useRef<Point | null>(null);
  const eraseDirty = useRef(false);
  const eraserRing = useRef<HTMLDivElement>(null);
  function eraserRadius() {
    // The eraser grows with the ふとさ choice, like a real eraser size.
    return 12 + activeBrush.current.width * 1.9;
  }
  function eraseOnce(center: Point, radius: number) {
    const result = eraseStrokes(working.current, center, radius, (original, parts) => {
      const style = brushStyles.current.get(original);
      if (style) for (const part of parts) brushStyles.current.set(part, style);
    });
    if (result.changed) {
      working.current = result.strokes;
      eraseDirty.current = true;
    }
  }
  function eraseAt(position: Point) {
    const radius = eraserRadius();
    const from = lastErase.current;
    if (from) {
      // Fill the gap between samples so a fast swipe erases continuously.
      const distance = Math.hypot(position.x - from.x, position.y - from.y);
      const steps = Math.max(1, Math.ceil(distance / (radius / 2)));
      for (let s = 1; s <= steps; s++)
        eraseOnce(
          {
            x: from.x + ((position.x - from.x) * s) / steps,
            y: from.y + ((position.y - from.y) * s) / steps,
          },
          radius,
        );
    } else {
      eraseOnce(position, radius);
    }
    lastErase.current = position;
    paint();
  }
  function moveEraserRing(event: { clientX: number; clientY: number }) {
    const ring = eraserRing.current;
    const canvas = ref.current;
    if (!ring || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const diameter = eraserRadius() * 2 * (rect.width / 600);
    ring.style.width = `${diameter}px`;
    ring.style.height = `${diameter}px`;
    ring.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px) translate(-50%, -50%)`;
    ring.style.opacity = "1";
  }
  function hideEraserRing() {
    if (eraserRing.current) eraserRing.current.style.opacity = "0";
  }
  const brushRing = useRef<HTMLDivElement>(null);
  function moveBrushRing(event: { clientX: number; clientY: number }) {
    const ring = brushRing.current;
    const canvas = ref.current;
    if (!ring || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const diameter = Math.max(
      6,
      activeBrush.current.width * (rect.width / 600),
    );
    ring.style.width = `${diameter}px`;
    ring.style.height = `${diameter}px`;
    ring.style.borderColor = activeBrush.current.color;
    ring.style.backgroundColor = `${activeBrush.current.color}33`;
    ring.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px) translate(-50%, -50%)`;
    ring.style.opacity = "1";
  }
  function hideBrushRing() {
    if (brushRing.current) brushRing.current.style.opacity = "0";
  }
  function finish() {
    if (active.current === null) return;
    const pointerId = active.current;
    active.current = null;
    if (activeTool.current === "eraser") {
      if (eraseDirty.current)
        callbacks.current.onChange(working.current, "erase");
      eraseDirty.current = false;
      lastErase.current = null;
      hideEraserRing();
    } else if (current.current.length) {
      const next = current.current;
      if (next.length === 1)
        next.push({
          ...next[0],
          x: next[0].x + (next[0].x < 600 ? 0.01 : -0.01),
        });
      if (clipStrokes([next], scene).length) {
        brushStyles.current.set(next, { ...activeBrush.current });
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
    <div
      className={"sketch-card" + (missionTitle ? " mission-sketch" : "")}
      data-layout={missionTitle ? layout : undefined}
    >
      {missionTitle && (
        <div
          className="sketch-layout-switch"
          role="group"
          aria-label="画面の向き"
        >
          <button
            type="button"
            aria-pressed={layout === "portrait"}
            onClick={() => setLayoutChoice("portrait")}
          >
            たて
          </button>
          <button
            type="button"
            aria-pressed={layout === "landscape"}
            onClick={() => setLayoutChoice("landscape")}
          >
            よこ
          </button>
        </div>
      )}
      {missionTitle && (
        <div className="mission-heading">
          <span>MISSION</span>
          <h1>{missionTitle}</h1>
          {landscapeInstruction && (
            <div className="landscape-instruction">{landscapeInstruction}</div>
          )}
        </div>
      )}
      <div className="sketch-frame">
        <div className="paper-top">
          <span>
            <i />
            かんさつスケッチ
          </span>
        </div>
        {missionTitle && (
          <div className="sketch-history" role="group" aria-label="描画履歴">
            <button
              aria-label="ひとつ戻す"
              disabled={!(canUndo ?? !!strokes.length)}
              onClick={() =>
                onUndo ? onUndo() : onChange(strokes.slice(0, -1), "erase")
              }
            >
              <Undo2 size={25} aria-hidden="true" />
              <span>もどる</span>
            </button>
            <button
              aria-label="ひとつ進む"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 size={25} aria-hidden="true" />
              <span>すすむ</span>
            </button>
          </div>
        )}
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
                if (activeTool.current === "eraser") {
                  lastErase.current = null;
                  moveEraserRing(event);
                  eraseAt(position);
                } else {
                  if (event.pointerType !== "touch") moveBrushRing(event);
                  current.current = [position];
                  setDrawing(true);
                  paint();
                }
              }}
              onPointerMove={(event) => {
                if (erase) moveEraserRing(event);
                else if (event.pointerType !== "touch") moveBrushRing(event);
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
              onPointerLeave={() => {
                if (active.current === null) hideEraserRing();
                hideBrushRing();
              }}
            />
            {erase && (
              <div
                ref={eraserRing}
                className="eraser-ring"
                aria-hidden="true"
              />
            )}
            {!erase && (
              <div ref={brushRing} className="brush-ring" aria-hidden="true" />
            )}
          </div>
        </div>
        {hintControl && (
          <div className="sketch-hint-control">{hintControl}</div>
        )}
        {landscapeReselect && (
          <div className="landscape-reselect">{landscapeReselect}</div>
        )}
      </div>
      <div className="tools" aria-label="描画ツール">
        {missionTitle ? (
          <>
            <div className="tool-group tool-group-actions">
              <span className="tool-group-label">ツール</span>
              <div className="tool-options">
                <button aria-pressed={!erase} onClick={() => setErase(false)}>
                  <Pencil size={19} />
                  ペン
                </button>
                <button aria-pressed={erase} onClick={() => setErase(true)}>
                  <Eraser size={19} />
                  消しゴム
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
            </div>
            <div className="tool-group tool-group-width">
              <span className="tool-group-label">ふとさ</span>
              <div className="tool-options">
                {BRUSH_WIDTHS.map((width) => (
                  <button
                    key={width}
                    className="brush-choice"
                    aria-label={`ふとさ ${width}`}
                    aria-pressed={brushWidth === width}
                    onClick={() => {
                      activeBrush.current = { ...activeBrush.current, width };
                      setBrushWidth(width);
                    }}
                  >
                    <span
                      className="brush-dot"
                      style={{ width, height: width }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="tool-group tool-group-color">
              <span className="tool-group-label">カラー</span>
              <div className="tool-options">
                {BRUSH_COLORS.map((color, index) => (
                  <button
                    key={color}
                    className="brush-choice"
                    aria-label={`カラー ${index + 1}`}
                    aria-pressed={brushColor === color}
                    onClick={() => {
                      activeBrush.current = { ...activeBrush.current, color };
                      setBrushColor(color);
                    }}
                  >
                    <span
                      className="color-dot"
                      style={{ backgroundColor: color }}
                    />
                  </button>
                ))}
              </div>
            </div>
            {landscapeComplete && (
              <div className="landscape-complete">{landscapeComplete}</div>
            )}
          </>
        ) : (
          <>
            <div className="tool-group tool-group-actions">
              <span className="tool-group-label">ツール</span>
              <div className="tool-options">
                <button aria-pressed={!erase} onClick={() => setErase(false)}>
                  <Pencil size={19} />
                  ペン
                </button>
                <button aria-pressed={erase} onClick={() => setErase(true)}>
                  <Eraser size={19} />
                  消しゴム
                </button>
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
            </div>
            <div className="tool-group tool-group-width">
              <span className="tool-group-label">ふとさ</span>
              <div className="tool-options">
                {BRUSH_WIDTHS.map((width) => (
                  <button
                    key={width}
                    className="brush-choice"
                    aria-label={`ふとさ ${width}`}
                    aria-pressed={brushWidth === width}
                    onClick={() => {
                      activeBrush.current = { ...activeBrush.current, width };
                      setBrushWidth(width);
                    }}
                  >
                    <span
                      className="brush-dot"
                      style={{ width, height: width }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="tool-group tool-group-color">
              <span className="tool-group-label">カラー</span>
              <div className="tool-options">
                {BRUSH_COLORS.map((color, index) => (
                  <button
                    key={color}
                    className="brush-choice"
                    aria-label={`カラー ${index + 1}`}
                    aria-pressed={brushColor === color}
                    onClick={() => {
                      activeBrush.current = { ...activeBrush.current, color };
                      setBrushColor(color);
                    }}
                  >
                    <span
                      className="color-dot"
                      style={{ backgroundColor: color }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {erase && (
        <p className="eraser-tip">なぞった部分だけ消えるよ。ふとさで消しゴムの大きさも変わるよ。</p>
      )}
    </div>
  );
}
