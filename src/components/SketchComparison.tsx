import { artwork, assetPath } from "../content/artwork";
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
  const art = artwork[scene.id];
  void profile;
  const reduce = useReducedMotion();
  return (
    <div className="sketch-comparison completion-panel">
      <p>自分の線と、お手本を見くらべよう。</p>
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
      {/* One SVG viewport shares the Canvas's 600 × 400 logical coordinates.
          No fitting to the user's bounds or independent layer scaling. */}
      <svg
        className="comparison-overlay"
        viewBox="0 0 600 400"
        preserveAspectRatio="none"
        role="img"
        aria-label={scene.label + "の描画とお手本"}
        data-mode={mode}
      >
        <defs>
          <clipPath id={clipId}>
            <SceneRegions scene={scene} />
          </clipPath>
        </defs>
        <SceneBase scene={scene} completed />
        <g clipPath={`url(#${clipId})`}>
          <motion.g
            animate={{ opacity: mode === "answer" ? 0 : 1 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            data-testid="user-lines"
            visibility={mode === "answer" ? "hidden" : "visible"}
          >
            <SketchLines strokes={clipStrokes(strokes, scene)} />
          </motion.g>
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
            {art?.answer ? (
              <image
                href={assetPath(art.answer)}
                width="600"
                height="400"
                preserveAspectRatio="none"
              />
            ) : scene.answerPath ? (
              <path
                d={scene.answerPath}
                fill={["goat", "sheep"].includes(scene.id) ? "#242e2b" : "none"}
                stroke={
                  ["goat", "sheep"].includes(scene.id) ? "#242e2b" : "#db7747"
                }
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
        <span>
          {["goat", "sheep"].includes(scene.id)
            ? "半透明の黒：瞳孔のお手本"
            : "半透明：お手本"}
        </span>
      </p>
      <p className="result-caption">
        そっくりでなくても大丈夫。実物で見つけた形を見くらべよう。
      </p>
    </div>
  );
}
