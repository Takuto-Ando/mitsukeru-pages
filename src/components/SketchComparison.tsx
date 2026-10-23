import { scenes, clipStrokes, type Scene } from "../content/scenes";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { useState, useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SketchLines, PupilShape } from "../Illustrations";
import type { ObservationGroup } from "../content/groups";
import type { Stroke } from "../types";

export function SketchComparison({
  strokes,
  answer,
  profile,
  scene = scenes.goat,
}: {
  strokes: Stroke[];
  scene?: Scene;
  profile?: { background: string; answer: string };
  answer: ObservationGroup["answer"];
}) {
  const [mode, setMode] = useState<"drawing" | "answer" | "overlay">("drawing");
  const clipId = useId();
  const reduce = useReducedMotion();
  return (
    <div className="sketch-comparison">
      <p>
        自分の描いた線で、動物の姿が完成したね。比較するときは「重ねる」を押してね。
      </p>
      <div className="comparison-modes" role="group" aria-label="比較の表示">
        {(
          [
            ["drawing", "自分の線"],
            ["overlay", "重ねる"],
            ["answer", "正解"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* One SVG viewport shares the Canvas's 600 × 400 logical coordinates.
          No fitting to the user's bounds or independent layer scaling. */}
      <svg
        className="comparison-overlay"
        viewBox="0 0 600 400"
        preserveAspectRatio="none"
        role="img"
        aria-label="ヤギの横長の瞳孔の模式図"
        data-mode={mode}
      >
        <defs>
          <clipPath id={clipId}>
            <SceneRegions scene={scene} />
          </clipPath>
        </defs>
        <SceneBase scene={scene} completed />
        <g clipPath={`url(#${clipId})`}>
          <g
            data-testid="user-lines"
            visibility={mode === "answer" ? "hidden" : "visible"}
          >
            <SketchLines strokes={clipStrokes(strokes, scene)} />
          </g>
          <motion.g
            data-testid="answer-shape"
            visibility={mode === "drawing" ? "hidden" : "visible"}
            key={mode}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{
              duration: reduce ? 0 : 0.8,
              delay: reduce ? 0 : 0.35,
            }}
          >
            {profile ? (
              <path
                d={scene.answerPath}
                fill="none"
                stroke="#db7747"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : scene.answerAsset || answer.asset ? (
              <image
                href={
                  import.meta.env.BASE_URL + (scene.answerAsset || answer.asset)
                }
                x="0"
                y="0"
                width="600"
                height="400"
                preserveAspectRatio="none"
              />
            ) : (
              <PupilShape fill="#242e2b" />
            )}
          </motion.g>
        </g>
      </svg>
      <p className="comparison-legend">
        <span>ターコイズ：自分の線</span>
        <span>半透明の黒：正解の模式図</span>
      </p>
      <p className="result-caption">
        模式図は一例です。形の完全一致を求めず、実物で見えた特徴を確かめよう。
      </p>
    </div>
  );
}
