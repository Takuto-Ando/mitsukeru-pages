import { CornerDownLeft } from "lucide-react";
import { Pitsune, PitsuneIcon } from "../components/Pitsune";
import { assetPath } from "../content/artwork";
import { ReflectionNote } from "../components/ReflectionNote";
import { SketchComparison } from "../components/SketchComparison";
import { TongueCelebration } from "../components/TongueCelebration";
import type { ObservationGroup } from "../content/groups";
import type { ObservationTask } from "../content/tasks";
import { ReadAloud } from "../speech/Speech";
import type { Evaluation, Stroke } from "../types";
import { designCardViewport } from "../drawing/viewport";

type Reflection = { discovery: string; revisited: boolean };

export function ResultScreen({
  task,
  group,
  strokes,
  feedback,
  reflection,
  onReflectionChange,
  saving,
  saved,
  reflectionDirty,
  storageReady,
  completedGroup,
  onConfirm,
  onRedraw,
  onNext,
  onUpdateReflection,
  onLearn,
  onExport,
  onShare,
  onSliderCommit,
}: {
  task: ObservationTask;
  group: ObservationGroup;
  strokes: Stroke[];
  feedback?: Evaluation;
  reflection: Reflection;
  onReflectionChange: (value: Reflection) => void;
  saving: boolean;
  saved: boolean;
  reflectionDirty: boolean;
  storageReady: boolean;
  completedGroup: string;
  onConfirm: () => void;
  onRedraw: () => void;
  onNext: () => void;
  onUpdateReflection?: () => void;
  onLearn: () => void;
  onExport: (kind: "own" | "comparison") => void;
  onShare: () => void;
  onSliderCommit: (
    from: number,
    to: number,
    via: "pointer" | "keyboard",
  ) => void;
}) {
  const passed = !!feedback?.passed;
  const message = passed ? "上手に描けたね！" : "見えた形を確かめよう";
  const fact = task.explanation.ecology || task.explanation.form;
  return (
    <div className="design3-result">
      <div className="result-pitsune">
        <img
          alt=""
          className="result-pitsune-face"
          src={assetPath("figma/entry/sketch-face.svg")}
        />
        <h1 className="pitsune-bubble">
          {passed ? (
            <img
              className="drawing-lettering"
              src={assetPath(
                "illustrations/pdf-design/drawing-prompt-success.svg",
              )}
              alt={message}
            />
          ) : (
            message
          )}
        </h1>
      </div>
      <SketchComparison
        strokes={strokes}
        scene={task.scene}
        profile={task.profile}
        answer={group.answer}
        note={task.comparisonNote}
        completed={passed}
        initialMode="drawing"
        viewport={designCardViewport(task.scene)}
        onSliderCommit={onSliderCommit}
        cardFooter={fact && <p className="result-fact">{fact}</p>}
        afterCard={
          <div className="drawing-actions result-actions">
            <button
              className="drawing-pill drawing-pill-green"
              disabled={saving}
              onClick={onRedraw}
            >
              <CornerDownLeft size={18} aria-hidden="true" />
              <img
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-redraw.svg",
                )}
                alt="描きなおす"
              />
            </button>
            <button
              className="drawing-pill"
              disabled={!passed || !storageReady || saving || !strokes.length}
              onClick={onNext}
            >
              <PitsuneIcon className="drawing-pitsune-icon" />
              {saving ? "観察を保存中…" : "つぎへ"}
            </button>
          </div>
        }
      />
      {completedGroup && saved && (
        <p className="group-complete-banner">
          <Pitsune pose="cheer" className="group-complete-pitsune" />
          {completedGroup} コンプリート！ ぜんぶの観察がそろったよ
        </p>
      )}
      {!passed && (
        <div className="self-check">
          <p>実物とお手本を見くらべて、気づいたところはあった？</p>
          <button className="primary" onClick={onConfirm}>
            見くらべて、確かめた！
          </button>
        </div>
      )}
      <div className="result-read-aloud">
        <ReadAloud id="result" text={message} />
        {fact && <ReadAloud id="result-fact" text={fact} />}
      </div>
      {task.id === "giraffe" && (
        <TongueCelebration strokes={strokes} scene={task.scene} />
      )}
      <ReflectionNote
        value={reflection}
        question={task.next}
        disabled={saving}
        onChange={onReflectionChange}
      />
      <p className="quiet-note" role="status">
        {saved
          ? "保存したよ！ マイギャラリーから、いつでも見返せるよ。"
          : "自分の絵をこの端末に残せます。撮影写真は保存しません。"}
      </p>
      {saved && reflectionDirty && onUpdateReflection && (
        <button
          className="text-button"
          disabled={saving || !storageReady}
          onClick={onUpdateReflection}
        >
          気づきを更新する
        </button>
      )}
      {strokes.length > 0 && (
        <div className="png-actions">
          <button
            className="text-button"
            disabled={saving}
            onClick={() => onExport("own")}
          >
            自分の絵をPNGで保存
          </button>
          <button
            className="text-button"
            disabled={saving}
            onClick={() => onExport("comparison")}
          >
            比較画像をPNGで保存
          </button>
          <button className="text-button" disabled={saving} onClick={onShare}>
            シェア
          </button>
        </div>
      )}
      <button
        className="primary"
        disabled={!passed || saving}
        onClick={onLearn}
      >
        特徴について知ろう →
      </button>
    </div>
  );
}
