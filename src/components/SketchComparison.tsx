import { useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { artwork, assetPath } from "../content/artwork";
import { scenes, clipStrokes, type Scene } from "../content/scenes";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import type { ObservationGroup } from "../content/groups";
import type { Stroke } from "../types";
type Mode = "slider" | "drawing" | "answer" | "overlay";
export function SketchComparison({
  strokes,
  scene = scenes.goat,
  note,
  completed = false,
  images,
  onSliderCommit,
}: {
  strokes: Stroke[];
  scene?: Scene;
  note?: string;
  completed?: boolean;
  images?: { own: string; answer: string };
  onSliderCommit?: (
    from: number,
    to: number,
    via: "pointer" | "keyboard",
  ) => void;
  profile?: { background: string; answer: string };
  answer: ObservationGroup["answer"];
}) {
  const [mode, setMode] = useState<Mode>("slider"),
    [position, setPosition] = useState(50);
  const clip = useId(),
    left = useId(),
    right = useId(),
    reduce = useReducedMotion();
  const drag = useRef<{ id: number; from: number } | undefined>(undefined),
    value = useRef(position);
  const art = scene.artworkOverride || artwork[scene.id],
    height = scene.frameHeight || 400;
  const set = (n: number) => {
    const next = Math.max(0, Math.min(100, Math.round(n)));
    value.current = next;
    setPosition(next);
  };
  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };
  const commit = (via: "pointer" | "keyboard", from: number) => {
    if (from !== value.current) onSliderCommit?.(from, value.current, via);
  };
  return (
    <div className="sketch-comparison completion-panel">
      <p>{note || "自分の絵とお手本を、同じ場所で見くらべよう。"}</p>
      <div className="comparison-modes" role="group" aria-label="比較の表示">
        {(
          [
            ["slider", "左右で比べる"],
            ["drawing", "自分の絵"],
            ["overlay", "重ね合わせ"],
            ["answer", "お手本"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} aria-pressed={mode === v} onClick={() => setMode(v)}>
            {label}
          </button>
        ))}
      </div>
      <div className="comparison-stage">
        <motion.svg
          className="comparison-overlay"
          initial={false}
          animate={
            completed && !reduce
              ? { rotateY: [-5, 0], opacity: [0.8, 1] }
              : { rotateY: 0, opacity: 1 }
          }
          transition={{ duration: reduce ? 0 : 0.32, ease: "easeOut" }}
          viewBox={`0 0 600 ${height}`}
          style={{ aspectRatio: `600 / ${height}` }}
          preserveAspectRatio="none"
          role="img"
          aria-label={scene.label + "の描画とお手本"}
          data-mode={mode}
        >
          <defs>
            <clipPath id={clip}>
              <SceneRegions scene={scene} />
            </clipPath>
            <clipPath id={left}>
              <rect width={position * 6} height={height} />
            </clipPath>
            <clipPath id={right}>
              <rect
                x={position * 6}
                width={600 - position * 6}
                height={height}
              />
            </clipPath>
          </defs>
          {!images && <SceneBase scene={scene} completed />}
          <g
            clipPath={mode === "slider" ? `url(#${left})` : undefined}
            visibility={mode === "answer" ? "hidden" : "visible"}
            data-testid="comparison-left"
          >
            {images ? (
              <image href={images.own} width="600" height={height} />
            ) : (
              <SceneBase scene={scene} completed />
            )}
          </g>
          <motion.g
            data-testid="answer-shape"
            data-answer-kind={
              art.reference || images ? "complete-animal" : "legacy"
            }
            clipPath={mode === "slider" ? `url(#${right})` : undefined}
            visibility={mode === "drawing" ? "hidden" : "visible"}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: mode === "drawing" ? 0 : 1 }}
            transition={{ duration: reduce ? 0 : 0.8 }}
          >
            {images ? (
              <image href={images.answer} width="600" height={height} />
            ) : art.reference ? (
              <image
                href={assetPath(art.reference)}
                width="600"
                height={height}
                preserveAspectRatio="none"
              />
            ) : (
              <g clipPath={`url(#${clip})`}>
                <image
                  href={assetPath(art.answer || art.explanation!)}
                  width="600"
                  height={height}
                />
              </g>
            )}
          </motion.g>
          <g clipPath={mode === "slider" ? `url(#${left})` : undefined}>
            <g clipPath={`url(#${clip})`}>
              <motion.g
                data-testid="user-lines"
                visibility={mode === "answer" ? "hidden" : "visible"}
                animate={{ opacity: mode === "answer" ? 0 : 1 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
              >
                <SketchLines strokes={clipStrokes(strokes, scene)} />
              </motion.g>
            </g>
          </g>
        </motion.svg>
        {mode === "slider" && (
          <div
            className="comparison-slider"
            role="slider"
            tabIndex={0}
            aria-label="自分の絵とお手本の境目"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={position}
            aria-valuetext={`左が自分の絵、右がお手本。境目は${position}パーセント`}
            onPointerDown={(e) => {
              if (drag.current || !e.isPrimary || e.button !== 0) return;
              e.preventDefault();
              drag.current = { id: e.pointerId, from: value.current };
              e.currentTarget.setPointerCapture(e.pointerId);
              point(e);
            }}
            onPointerMove={(e) => {
              if (drag.current?.id === e.pointerId) point(e);
            }}
            onPointerUp={(e) => {
              if (drag.current?.id !== e.pointerId) return;
              point(e);
              commit("pointer", drag.current.from);
              drag.current = undefined;
            }}
            onPointerCancel={() => {
              if (drag.current) {
                commit("pointer", drag.current.from);
                drag.current = undefined;
              }
            }}
            onLostPointerCapture={() => {
              if (drag.current) {
                commit("pointer", drag.current.from);
                drag.current = undefined;
              }
            }}
            onKeyDown={(e) => {
              const from = value.current;
              let n = from;
              const step = e.shiftKey ? 10 : 1;
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") n -= step;
              else if (e.key === "ArrowRight" || e.key === "ArrowUp") n += step;
              else if (e.key === "Home") n = 0;
              else if (e.key === "End") n = 100;
              else return;
              e.preventDefault();
              set(n);
              commit("keyboard", from);
            }}
          >
            <span
              className="comparison-divider"
              style={{ left: `${position}%` }}
            >
              <span aria-hidden="true">↔</span>
            </span>
          </div>
        )}
      </div>
      <p className="comparison-legend">
        {mode === "slider" ? (
          <>
            <span>左：自分の絵</span>
            <span>右：お手本</span>
          </>
        ) : (
          <>
            <span>ターコイズ：自分の線</span>
            <span>完成した動物：お手本</span>
          </>
        )}
      </p>
      <p className="result-caption">
        {mode === "slider"
          ? "境目を動かして、見つけた形を比べてみよう。"
          : "そっくりでなくても大丈夫。見えた形を確かめよう。"}
      </p>
    </div>
  );
}
