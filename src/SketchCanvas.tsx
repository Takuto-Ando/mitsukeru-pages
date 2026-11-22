import { BubbleLine } from "./components/BubbleLine";
import { CardLettering } from "./components/CardLettering";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import "./styles/design3-drawing.css";
import {
  RotateCcw,
  LayoutGrid,
  Image as ImageIcon,
  Eye,
  PaintBucket,
} from "lucide-react";
import { artwork, assetPath } from "./content/artwork";
import {
  drawingRegions,
  scenes,
  clipStrokes,
  scenePoint,
  type Scene,
} from "./content/scenes";
import { createPortal } from "react-dom";
import type { PenColors } from "./content/sketchPresentation";
import { SceneBase, SceneRegions } from "./components/ObservationScene";
import { TargetRegions } from "./components/TargetRegions";
import type { DrawingAction } from "./drawing/history";
import { eraseStrokes } from "./drawing/erase";
import { stabilizePoint } from "./drawing/smooth";
import { getStrokeStyle, setStrokeStyle } from "./drawing/styles";
import { STAMPS, drawStamp } from "./drawing/stamps";
import { currentSeason } from "./future/seasons";
import { designCardViewport } from "./drawing/viewport";
import type { Point, Stroke } from "./types";

const BLANK_SCENE: Scene = {
  id: "free-drawing",
  label: "自由に描くスケッチ",
  frameHeight: 660,
  regions: [{ x: 0, y: 0, width: 1, height: 1 }],
};

const BRUSH_WIDTHS = [2.5, 4, 7, 11];
const BRUSH_COLORS = [
  "#6b5c7a",
  "#977baf",
  "#3a3238",
  "#8a6642",
  "#b0563a",
  "#277e78",
  "#8d8577",
  "#e58c76",
  "#f2b544",
  "#7fb069",
  "#5da9e9",
  "#e88bb0",
];

export function SketchCanvas({
  strokes,
  onChange,
  template = "eye",
  scene = template === "blank" ? BLANK_SCENE : scenes.goat,
  onDrawingActivity,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  missionTitle,
  missionLettering,
  missionHighlights,
  initialPenColors,
  fixedPortrait = false,
  inkBehindArtwork = false,
  unrestrictedDrawing = false,
  hideZoomAndEraserTip = false,
  dopa = false,
  actions,
  drawingDecoration,
  landscapeReselect,
  showTarget = false,
  photoUrl,
  coloringSrc,
  canvasRef,
}: {
  onDrawingActivity?: (
    active: boolean,
    tool: "pen" | "eraser" | "fill",
  ) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  missionTitle?: string;
  missionLettering?: string;
  missionHighlights?: readonly string[];
  initialPenColors?: PenColors;
  fixedPortrait?: boolean;
  inkBehindArtwork?: boolean;
  unrestrictedDrawing?: boolean;
  hideZoomAndEraserTip?: boolean;
  dopa?: boolean;
  actions?: ReactNode;
  drawingDecoration?: ReactNode;
  landscapeReselect?: ReactNode;
  showTarget?: boolean;
  photoUrl?: string;
  /** ぬりえモード：線画風に薄く敷く下絵（assetPath 前の相対パス）。 */
  coloringSrc?: string;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  template?: "eye" | "blank";
  scene?: Scene;
  strokes: Stroke[];
  onChange: (next: Stroke[], action: DrawingAction) => void;
}) {
  const frameHeight = scene.frameHeight || 400;
  // The giraffe artwork itself masks the ink wherever its pixels are opaque.
  const useFullForeground = scene.id === "giraffe";
  const drawForeground =
    useFullForeground || (inkBehindArtwork && !unrestrictedDrawing);
  const foregroundMask = useId();
  const activeTool = useRef<"pen" | "eraser" | "fill">("pen");
  const [fillMode, setFillMode] = useState(false);
  const [stampMode, setStampMode] = useState(false);
  const [stampId, setStampId] = useState(STAMPS[0].id);
  const [zoom, setZoom] = useState(1);
  const fillImages = useRef(new Map<string, HTMLImageElement>());
  const ownCanvas = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? ownCanvas;
  const active = useRef<number | null>(null),
    current = useRef<Stroke>([]);
  const [drawing, setDrawing] = useState(false),
    [erase, setErase] = useState(false),
    [brushWidth, setBrushWidth] = useState(7);
  const [selectedPen, setSelectedPen] = useState<0 | 1>(0);
  const defaultPen =
    initialPenColors?.[0] ?? (missionTitle ? BRUSH_COLORS[0] : "#277e78");
  const [penColors, setPenColors] = useState<PenColors>([
    defaultPen,
    initialPenColors?.[1] ?? BRUSH_COLORS[1],
  ]);
  const brushColor = penColors[selectedPen];
  const [brushPreview, setBrushPreview] = useState(false);
  const widthPointer = useRef<number | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);

  function hideBrushPreview() {
    window.clearTimeout(previewTimer.current);
    widthPointer.current = null;
    setBrushPreview(false);
  }

  function showBrushPreview() {
    window.clearTimeout(previewTimer.current);
    setBrushPreview(true);
    if (widthPointer.current === null) {
      previewTimer.current = window.setTimeout(hideBrushPreview, 650);
    }
  }

  useEffect(() => {
    function endAdjustment(event: PointerEvent) {
      if (event.pointerId === widthPointer.current) hideBrushPreview();
    }
    window.addEventListener("pointerup", endAdjustment);
    window.addEventListener("pointercancel", endAdjustment);
    window.addEventListener("blur", hideBrushPreview);
    return () => {
      window.removeEventListener("pointerup", endAdjustment);
      window.removeEventListener("pointercancel", endAdjustment);
      window.removeEventListener("blur", hideBrushPreview);
      window.clearTimeout(previewTimer.current);
    };
  }, []);
  const [layoutChoice, setLayoutChoice] = useState<
    "portrait" | "landscape" | null
  >(null);
  const [autoLayout, setAutoLayout] = useState<"portrait" | "landscape">(() =>
    window.matchMedia("(min-width: 760px)").matches ? "landscape" : "portrait",
  );
  const layout = fixedPortrait ? "portrait" : (layoutChoice ?? autoLayout);
  function chooseLayout(next: "portrait" | "landscape") {
    if (layout === next) return;
    setLayoutChoice(next);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }
  const viewport =
    layout === "portrait" && missionTitle
      ? designCardViewport(scene)
      : undefined;
  const viewportStyle = viewport
    ? {
        width: `${(600 / viewport.width) * 100}%`,
        height: `${(frameHeight / viewport.height) * 100}%`,
        left: `${(-viewport.x / viewport.width) * 100}%`,
        top: `${(-viewport.y / viewport.height) * 100}%`,
      }
    : undefined;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteTrigger = useRef<HTMLButtonElement>(null);
  const paletteId = useId();
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!paletteOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!toolsRef.current?.contains(event.target as Node))
        setPaletteOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPaletteOpen(false);
      paletteTrigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [paletteOpen]);
  const [assist, setAssist] = useState({
    grid: false,
    photo: false,
    ghost: false,
  });
  const ghostSrc = (scene.artworkOverride || artwork[scene.id])?.reference;
  const CHEERS = [
    "いいかんじ！",
    "よく見てるね！",
    "その調子！",
    "すてきな線だね！",
    "じっくり観察できてる！",
  ];
  const [cheer, setCheer] = useState("");
  const cheerTimer = useRef<number | undefined>(undefined);
  const prevStrokeCount = useRef(strokes.length);
  const firstStrokeCheered = useRef(false);
  useEffect(() => {
    const prev = prevStrokeCount.current;
    prevStrokeCount.current = strokes.length;
    if (!missionTitle || strokes.length <= prev) return;
    const firstMark =
      dopa && strokes.length === 1 && !firstStrokeCheered.current;
    if (!firstMark && strokes.length % 3 !== 0) return;
    if (firstMark) firstStrokeCheered.current = true;
    setCheer(
      firstMark
        ? "いい線だね！"
        : CHEERS[Math.floor(strokes.length / 3 - 1) % CHEERS.length],
    );
    window.clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => setCheer(""), 2600);
  }, [dopa, strokes.length, missionTitle]);
  useEffect(() => () => window.clearTimeout(cheerTimer.current), []);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 760px)");
    const update = () =>
      setAutoLayout(media.matches ? "landscape" : "portrait");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const activeBrush = useRef({ width: brushWidth, color: brushColor });
  const callbacks = useRef({ onChange, onDrawingActivity });
  callbacks.current = { onChange, onDrawingActivity };
  const working = useRef(strokes);
  if (active.current === null) working.current = strokes;
  const paintFrame = useRef<number | undefined>(undefined);
  const paintState = useRef({ scene, frameHeight, unrestrictedDrawing });
  paintState.current = { scene, frameHeight, unrestrictedDrawing };
  function paint() {
    if (paintFrame.current !== undefined) return;
    paintFrame.current = requestAnimationFrame(() => {
      paintFrame.current = undefined;
      const { scene, frameHeight, unrestrictedDrawing } = paintState.current;
      const canvas = ref.current;
      if (!canvas) return;
      // Allocate pixels for the displayed size, retaining logical 600-unit coordinates.
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(width / 600, 0, 0, height / frameHeight, 0, 0);
      context.clearRect(0, 0, 600, frameHeight);
      context.save();
      if (!unrestrictedDrawing) {
        context.beginPath();
        for (const r of drawingRegions(scene))
          context.rect(
            r.x * 600,
            r.y * frameHeight,
            r.width * 600,
            r.height * frameHeight,
          );
        context.clip();
      }
      context.lineCap = "round";
      context.lineJoin = "round";
      const draw = (stroke: Stroke, current = false) => {
        if (!stroke.length) return;
        if (!current && getStrokeStyle(stroke)?.fill) return;
        const stampStyle = current ? undefined : getStrokeStyle(stroke);
        if (stampStyle?.stamp && stroke.length <= 2) {
          drawStamp(
            context,
            stampStyle.stamp,
            stroke[0].x,
            stroke[0].y,
            Math.max(24, stampStyle.width),
            stampStyle.color,
          );
          return;
        }
        const style = current
          ? activeBrush.current
          : getStrokeStyle(stroke) || {
              width: 7,
              color: defaultPen,
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
      for (const stroke of working.current) {
        const fill = getStrokeStyle(stroke)?.fill;
        if (!fill) continue;
        let image = fillImages.current.get(fill);
        if (!image) {
          image = new Image();
          image.src = fill;
          image.onload = () => paint();
          fillImages.current.set(fill, image);
        }
        if (image.complete && image.naturalWidth)
          context.drawImage(image, 0, 0, 600, frameHeight);
      }
      for (const stroke of working.current) draw(stroke);
      draw(current.current, true);
      context.restore();
    });
  }
  useEffect(() => {
    paint();
  }, [strokes, scene, unrestrictedDrawing]);
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
    if (Math.hypot(smoothed.x - previous.x, smoothed.y - previous.y) >= 0.5)
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
    const result = eraseStrokes(
      working.current,
      center,
      radius,
      (original, parts) => {
        const style = getStrokeStyle(original);
        if (style) for (const part of parts) setStrokeStyle(part, style);
      },
    );
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
  function doFill(center: Point) {
    const regions = unrestrictedDrawing
      ? BLANK_SCENE.regions
      : drawingRegions(scene);
    const region = regions.find(
      (r) =>
        center.x >= r.x * 600 &&
        center.x <= (r.x + r.width) * 600 &&
        center.y >= r.y * frameHeight &&
        center.y <= (r.y + r.height) * frameHeight,
    );
    if (!region) return;
    const W = 600,
      H = frameHeight;
    const barrierCanvas = document.createElement("canvas");
    barrierCanvas.width = W;
    barrierCanvas.height = H;
    const bctx = barrierCanvas.getContext("2d");
    if (!bctx) return;
    bctx.fillStyle = "#fff";
    bctx.fillRect(0, 0, W, H);
    bctx.strokeStyle = "#000";
    bctx.lineCap = "round";
    bctx.lineJoin = "round";
    for (const stroke of working.current) {
      if (!stroke.length || getStrokeStyle(stroke)?.fill) continue;
      bctx.lineWidth = (getStrokeStyle(stroke)?.width ?? 7) + 2;
      bctx.beginPath();
      bctx.moveTo(stroke[0].x, stroke[0].y);
      for (const pt of stroke.slice(1)) bctx.lineTo(pt.x, pt.y);
      bctx.stroke();
    }
    bctx.lineWidth = 3;
    bctx.strokeRect(
      region.x * W + 1,
      region.y * H + 1,
      region.width * W - 2,
      region.height * H - 2,
    );
    const data = bctx.getImageData(0, 0, W, H).data;
    const isBarrier = (idx: number) => data[idx * 4] < 128;
    const sx = Math.max(0, Math.min(W - 1, Math.round(center.x))),
      sy = Math.max(0, Math.min(H - 1, Math.round(center.y)));
    if (isBarrier(sy * W + sx)) return;
    const visited = new Uint8Array(W * H);
    const stack: number[] = [sx, sy];
    const mask = document.createElement("canvas");
    mask.width = W;
    mask.height = H;
    const mctx = mask.getContext("2d");
    if (!mctx) return;
    const mimg = mctx.createImageData(W, H),
      md = mimg.data;
    const hex = activeBrush.current.color;
    const cr = parseInt(hex.slice(1, 3), 16),
      cg = parseInt(hex.slice(3, 5), 16),
      cb = parseInt(hex.slice(5, 7), 16);
    while (stack.length) {
      const y = stack.pop()!,
        x0 = stack.pop()!;
      let x = x0;
      const row = y * W;
      while (x >= 0 && !visited[row + x] && !isBarrier(row + x)) {
        visited[row + x] = 1;
        x--;
      }
      x++;
      let spanUp = false,
        spanDown = false;
      while (x < W && !visited[row + x] && !isBarrier(row + x)) {
        visited[row + x] = 1;
        const mi = (row + x) * 4;
        md[mi] = cr;
        md[mi + 1] = cg;
        md[mi + 2] = cb;
        md[mi + 3] = 140;
        if (y > 0) {
          const up = !visited[row - W + x] && !isBarrier(row - W + x);
          if (up && !spanUp) {
            stack.push(x, y - 1);
            spanUp = true;
          } else if (!up) spanUp = false;
        }
        if (y < H - 1) {
          const down = !visited[row + W + x] && !isBarrier(row + W + x);
          if (down && !spanDown) {
            stack.push(x, y + 1);
            spanDown = true;
          } else if (!down) spanDown = false;
        }
        x++;
      }
    }
    mctx.putImageData(mimg, 0, 0);
    const anchor: Stroke = [
      { x: center.x, y: center.y },
      { x: center.x + (center.x < 599 ? 0.01 : -0.01), y: center.y },
    ];
    setStrokeStyle(anchor, {
      color: activeBrush.current.color,
      width: 0,
      fill: mask.toDataURL(),
    });
    working.current = [...working.current, anchor];
    callbacks.current.onChange(working.current, "draw");
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
      if (unrestrictedDrawing || clipStrokes([next], scene).length) {
        setStrokeStyle(next, { ...activeBrush.current });
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
  const isFreeDrawing = template === "blank";
  const penActive = !erase && !fillMode;
  const penSlots =
    missionTitle && !isFreeDrawing ? ([0, 1] as const) : ([0] as const);
  function togglePalette(trigger: HTMLButtonElement, open = !paletteOpen) {
    paletteTrigger.current = trigger;
    setPaletteOpen(open);
  }
  const drawingAssists = (
    <div className="drawing-assists" role="group" aria-label="おたすけ">
      <span>おたすけ</span>
      <button
        type="button"
        aria-pressed={fillMode}
        onClick={() => {
          setFillMode(true);
          setErase(false);
          setPaletteOpen(false);
        }}
      >
        <PaintBucket size={15} aria-hidden="true" />
        バケツ
      </button>
      {dopa && (
        <button
          type="button"
          aria-pressed={stampMode}
          onClick={() => {
            setStampMode((v) => !v);
            setFillMode(false);
            setErase(false);
          }}
        >
          スタンプ
        </button>
      )}
      <button
        type="button"
        aria-pressed={assist.grid}
        onClick={() =>
          setAssist((current) => ({ ...current, grid: !current.grid }))
        }
      >
        <LayoutGrid size={15} aria-hidden="true" />
        グリッド
      </button>
      {photoUrl && (
        <button
          type="button"
          aria-pressed={assist.photo}
          onClick={() =>
            setAssist((current) => ({ ...current, photo: !current.photo }))
          }
        >
          <ImageIcon size={15} aria-hidden="true" />
          写真
        </button>
      )}
      {ghostSrc && (
        <button
          type="button"
          aria-pressed={assist.ghost}
          onClick={() =>
            setAssist((current) => ({ ...current, ghost: !current.ghost }))
          }
        >
          <Eye size={15} aria-hidden="true" />
          お手本
        </button>
      )}
      <button
        type="button"
        disabled={!strokes.length}
        onClick={() => {
          onChange([], "clear");
          setErase(false);
          setFillMode(false);
          setPaletteOpen(false);
        }}
      >
        <RotateCcw size={15} aria-hidden="true" />
        描き直す
      </button>
    </div>
  );
  const layoutSwitch = missionTitle && !fixedPortrait && (
    <div className="sketch-layout-switch" role="group" aria-label="画面の向き">
      <button
        type="button"
        aria-pressed={layout === "portrait"}
        onClick={() => chooseLayout("portrait")}
      >
        たて
      </button>
      <button
        type="button"
        aria-pressed={layout === "landscape"}
        onClick={() => chooseLayout("landscape")}
      >
        よこ
      </button>
    </div>
  );
  return (
    <div
      className={"sketch-card" + (missionTitle ? " mission-sketch" : "")}
      data-layout={missionTitle ? layout : undefined}
      data-free={isFreeDrawing || undefined}
      data-card-crop={!!viewport || undefined}
      style={
        {
          "--paper-ratio": viewport
            ? `(${viewport.aspectRatio})`
            : 600 / frameHeight,
        } as CSSProperties
      }
    >
      {missionTitle && (
        <div className="mission-heading">
          <div className="mission-pitsune-row">
            <img
              alt=""
              className="mission-pitsune-face"
              src={assetPath("figma/entry/sketch-face.svg")}
            />
            <h1 className="pitsune-bubble" aria-label={missionTitle}>
              {missionLettering &&
              import.meta.env.VITE_LEGACY_EDITIONS === "1" ? (
                <CardLettering
                  className="drawing-lettering"
                  src={assetPath(missionLettering)}
                  text={missionTitle}
                  highlights={missionHighlights}
                />
              ) : (
                <BubbleLine
                  text={missionTitle}
                  highlights={missionHighlights}
                />
              )}
            </h1>
            {cheer && (
              <span
                key={dopa ? cheer : undefined}
                className="pitsune-cheer"
                role="status"
              >
                {cheer}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="sketch-frame">
        <div className="sketch-history" role="group" aria-label="描画履歴">
          <button
            aria-label="ひとつ戻す"
            disabled={!(canUndo ?? !!strokes.length)}
            onClick={() =>
              onUndo ? onUndo() : onChange(strokes.slice(0, -1), "erase")
            }
          >
            <img alt="" src={assetPath("figma/entry/undo.svg")} />
            <span>もどる</span>
          </button>
          <button aria-label="ひとつ進む" disabled={!canRedo} onClick={onRedo}>
            <img alt="" src={assetPath("figma/entry/redo.svg")} />
            <span>すすむ</span>
          </button>
        </div>
        <div
          className={"drawing-paper " + (drawing ? "is-drawing" : "")}
          style={
            {
              aspectRatio: viewport?.aspectRatio ?? `600 / ${frameHeight}`,
              "--scene-ratio": 600 / frameHeight,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "center center",
              zIndex: zoom !== 1 ? 5 : undefined,
            } as CSSProperties
          }
        >
          <div
            className="scene-stage"
            style={viewportStyle}
            data-testid="full-animal-stage"
            data-view="whole"
          >
            <svg
              className="eye-template"
              viewBox={`0 0 600 ${frameHeight}`}
              preserveAspectRatio="none"
              aria-label={
                isFreeDrawing
                  ? "白い画用紙"
                  : scene.label + "を描き足すイラスト"
              }
              role="img"
            >
              {!isFreeDrawing && !useFullForeground && (
                <SceneBase scene={scene} />
              )}
              {showTarget && <TargetRegions scene={scene} />}
            </svg>
            {assist.ghost && ghostSrc && (
              <img
                className="underlay ghost-underlay"
                src={assetPath(ghostSrc)}
                alt=""
                aria-hidden="true"
              />
            )}
            {coloringSrc && (
              <img
                className="underlay coloring-underlay"
                src={assetPath(coloringSrc)}
                alt=""
                aria-hidden="true"
              />
            )}
            {assist.photo && photoUrl && (
              <img
                className="underlay photo-underlay"
                src={photoUrl}
                alt=""
                aria-hidden="true"
              />
            )}
            {assist.grid && (
              <svg
                className="underlay grid-overlay"
                viewBox={`0 0 600 ${frameHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {[100, 200, 300, 400, 500].map((x) => (
                  <line key={`v${x}`} x1={x} y1={0} x2={x} y2={frameHeight} />
                ))}
                {Array.from(
                  { length: Math.floor((frameHeight - 1) / 100) },
                  (_, i) => (i + 1) * 100,
                ).map((y) => (
                  <line key={`h${y}`} x1={0} y1={y} x2={600} y2={y} />
                ))}
              </svg>
            )}
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
                if (stampMode) {
                  active.current = null;
                  const anchor: Stroke = [
                    position,
                    { x: position.x + 0.01, y: position.y },
                  ];
                  setStrokeStyle(anchor, {
                    color: activeBrush.current.color,
                    width: 52,
                    stamp: stampId,
                  });
                  onChange([...strokes, anchor], "draw");
                  if (ref.current?.hasPointerCapture(event.pointerId))
                    ref.current.releasePointerCapture(event.pointerId);
                  callbacks.current.onDrawingActivity?.(false, "pen");
                  return;
                }
                if (fillMode) {
                  active.current = null;
                  doFill(position);
                  if (ref.current?.hasPointerCapture(event.pointerId))
                    ref.current.releasePointerCapture(event.pointerId);
                  callbacks.current.onDrawingActivity?.(false, "pen");
                  return;
                }
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
                if (
                  !event.isPrimary ||
                  (active.current !== null &&
                    active.current !== event.pointerId)
                )
                  return;
                if (erase) moveEraserRing(event);
                else if (event.pointerType !== "touch" && !fillMode)
                  moveBrushRing(event);
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
              onPointerLeave={(event) => {
                if (!event.isPrimary) return;
                if (active.current === null) hideEraserRing();
                hideBrushRing();
              }}
            />
            {drawForeground && !isFreeDrawing && (
              <svg
                className="eye-template drawing-foreground"
                viewBox={`0 0 600 ${frameHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {useFullForeground ? (
                  <SceneBase scene={scene} foreground />
                ) : (
                  <>
                    <defs>
                      <mask
                        id={foregroundMask}
                        maskUnits="userSpaceOnUse"
                        x="0"
                        y="0"
                        width="600"
                        height={frameHeight}
                      >
                        <rect width="600" height={frameHeight} fill="white" />
                        <g fill="black">
                          <SceneRegions scene={scene} />
                        </g>
                      </mask>
                    </defs>
                    <g mask={`url(#${foregroundMask})`}>
                      <SceneBase scene={scene} foreground />
                    </g>
                  </>
                )}
              </svg>
            )}
            {erase && (
              <div
                ref={eraserRing}
                className="eraser-ring"
                aria-hidden="true"
              />
            )}
            {!erase && !fillMode && (
              <div ref={brushRing} className="brush-ring" aria-hidden="true" />
            )}
          </div>
          {drawingDecoration}
        </div>
        {landscapeReselect && (
          <div className="landscape-reselect">{landscapeReselect}</div>
        )}
      </div>
      <div className="drawing-tools-stack">
        {layout === "landscape" && drawingAssists}
        <div
          className="tools drawing-tools"
          aria-label="描画ツール"
          ref={toolsRef}
        >
          <div className="drawing-tool-options" role="group" aria-label="道具">
            {isFreeDrawing && (
              <button
                type="button"
                className="drawing-color-wheel"
                aria-label="カラー"
                aria-expanded={paletteOpen}
                aria-controls={paletteId}
                onClick={(event) => togglePalette(event.currentTarget)}
              />
            )}
            {penSlots.map((pen) => (
              <button
                key={pen}
                type="button"
                aria-label={pen === 0 ? "ペン" : "2本目のペン"}
                aria-pressed={penActive && selectedPen === pen}
                aria-expanded={selectedPen === pen && paletteOpen}
                aria-controls={paletteId}
                title={pen === 0 ? "ペンと色" : "2本目のペンと色"}
                onClick={(event) => {
                  setErase(false);
                  setFillMode(false);
                  if (penActive && selectedPen === pen) {
                    togglePalette(event.currentTarget);
                    return;
                  }
                  setSelectedPen(pen);
                  activeBrush.current = {
                    ...activeBrush.current,
                    color: penColors[pen],
                  };
                  setPaletteOpen(false);
                }}
              >
                <svg
                  className="drawing-tool-art"
                  aria-hidden="true"
                  viewBox="0 0 50 50"
                >
                  <path
                    d="M14.937 30.063H35V50H14.937Z"
                    fill={penColors[pen]}
                  />
                  <path
                    d="M24.018 12.975L14.967 30.032H34.999L25.948 12.975C25.537 12.184 24.429 12.184 24.018 12.975Z"
                    fill="#f9cc8c"
                  />
                  <path
                    d="M24.02 12.975L21.14 18.355H28.83L25.95 12.975C25.539 12.184 24.431 12.184 24.02 12.975Z"
                    fill={penColors[pen]}
                  />
                </svg>
              </button>
            ))}
            <button
              type="button"
              aria-label="消しゴム"
              aria-pressed={erase}
              title="消しゴム"
              onClick={() => {
                setErase(true);
                setFillMode(false);
                setPaletteOpen(false);
              }}
            >
              <img
                className="drawing-tool-art"
                src={assetPath(
                  "illustrations/pdf-design/drawing-tool-eraser.svg",
                )}
                alt=""
              />
            </button>
          </div>
          <label className="drawing-width">
            <span className="drawing-width-label">ペンの太さ</span>
            <input
              type="range"
              aria-label="ペンの太さ"
              min={0}
              max={BRUSH_WIDTHS.length - 1}
              step={1}
              aria-valuetext={String(brushWidth)}
              value={BRUSH_WIDTHS.indexOf(brushWidth)}
              style={
                {
                  "--brush-range": `${(BRUSH_WIDTHS.indexOf(brushWidth) / (BRUSH_WIDTHS.length - 1)) * 100}%`,
                } as CSSProperties
              }
              onPointerDown={(event) => {
                widthPointer.current = event.pointerId;
                showBrushPreview();
              }}
              onBlur={hideBrushPreview}
              onChange={(event) => {
                const width = BRUSH_WIDTHS[event.currentTarget.valueAsNumber];
                activeBrush.current = { ...activeBrush.current, width };
                setBrushWidth(width);
                showBrushPreview();
              }}
            />
          </label>
          {brushPreview &&
            createPortal(
              <div
                aria-hidden="true"
                className="brush-width-preview"
                style={
                  {
                    "--preview-diameter":
                      brushWidth *
                        ((ref.current?.getBoundingClientRect().width || 600) /
                          600) +
                      "px",
                    "--preview-ink": brushColor,
                  } as CSSProperties
                }
              />,
              document.body,
            )}
          <div
            className="drawing-palette"
            id={paletteId}
            role="group"
            aria-label="カラー"
            hidden={!paletteOpen}
          >
            {BRUSH_COLORS.map((color, index) => (
              <button
                key={color}
                type="button"
                aria-label={`カラー ${index + 1}`}
                aria-pressed={brushColor === color}
                onClick={() => {
                  activeBrush.current = { ...activeBrush.current, color };
                  setPenColors((colors) =>
                    selectedPen === 0 ? [color, colors[1]] : [colors[0], color],
                  );
                  setPaletteOpen(false);
                  paletteTrigger.current?.focus();
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
        {actions && <div className="drawing-actions">{actions}</div>}
        {erase && !hideZoomAndEraserTip && (
          <p className="eraser-tip">
            なぞった部分だけ消えるよ。ふとさで消しゴムの大きさも変わるよ。
          </p>
        )}
        {fillMode && (
          <p className="eraser-tip">
            線で囲んだ中をタップすると、選んだ色でぬれるよ。
          </p>
        )}
        {stampMode && (
          <div className="stamp-picker" role="group" aria-label="スタンプの形">
            {STAMPS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={stampId === s.id}
                className={
                  (stampId === s.id ? "is-active" : "") +
                  (s.id === currentSeason().stampId ? " is-seasonal" : "")
                }
                onClick={() => setStampId(s.id)}
              >
                {s.label}
                {s.id === currentSeason().stampId && "（季節限定）"}
              </button>
            ))}
            <span className="stamp-tip">画用紙をタップすると置けるよ</span>
          </div>
        )}
        {(!hideZoomAndEraserTip ||
          (layout !== "landscape" && layoutSwitch)) && (
          <div className="drawing-zoom-row">
            {!hideZoomAndEraserTip && (
              <div
                className="zoom-controls"
                role="group"
                aria-label="拡大・縮小"
              >
                <button
                  type="button"
                  aria-label="縮小する"
                  disabled={zoom <= 1}
                  onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                >
                  −
                </button>
                <span aria-label={`現在の倍率 ${zoom}倍`}>{zoom}倍</span>
                <button
                  type="button"
                  aria-label="拡大する"
                  disabled={zoom >= 2}
                  onClick={() => setZoom((z) => Math.min(2, z + 0.5))}
                >
                  ＋
                </button>
              </div>
            )}
            {layout !== "landscape" && layoutSwitch}
          </div>
        )}
        {layout !== "landscape" && drawingAssists}
      </div>
      {layout === "landscape" && layoutSwitch}
    </div>
  );
}
