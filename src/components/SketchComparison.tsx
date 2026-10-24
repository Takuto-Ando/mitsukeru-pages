import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { artwork, assetPath } from "../content/artwork";
import { scenes, clipStrokes, type Scene } from "../content/scenes";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import type { ObservationGroup } from "../content/groups";
import type { Stroke } from "../types";
export function SketchComparison({
  strokes,
  scene = scenes.goat,
  note,
  completed = false,
}: {
  strokes: Stroke[];
  note?: string;
  completed?: boolean;
  scene?: Scene;
  profile?: { background: string; answer: string };
  answer: ObservationGroup["answer"];
}) {
  const [mode, setMode] = useState<"drawing" | "answer" | "overlay">("overlay");
  const clip = useId(),
    reduce = useReducedMotion();
  const art = scene.artworkOverride || artwork[scene.id];
  const height = scene.frameHeight || 400;
  return (
    <div className="sketch-comparison completion-panel">
      <p>{note || "完成した動物と、自分の線を見くらべよう。"}</p>
      <div className="comparison-modes" role="group" aria-label="比較の表示">
        {(
          [
            ["drawing", "自分の絵"],
            ["overlay", "重ね合わせ"],
            ["answer", "お手本"],
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
      <motion.svg
        className="comparison-overlay"
        initial={false}
        animate={completed && !reduce ? { scale: [1, 1.025, 1] } : { scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.7, ease: "easeOut" }}
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
        </defs>
        <SceneBase scene={scene} completed />
        <motion.g
          data-testid="answer-shape"
          data-answer-kind={art.reference ? "complete-animal" : "legacy"}
          visibility={mode === "drawing" ? "hidden" : "visible"}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: mode === "drawing" ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : 0.8 }}
        >
          {art.reference ? (
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
                preserveAspectRatio="none"
              />
            </g>
          )}
        </motion.g>
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
      </motion.svg>
      <p className="comparison-legend">
        <span>ターコイズ：自分の線</span>
        <span>完成した動物：お手本</span>
      </p>
      <p className="result-caption">
        そっくりでなくても大丈夫。実物で見つけた形を見くらべよう。
      </p>
    </div>
  );
}
