import { CircleHelp } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { DifficultyPill } from "../components/DifficultyPill";
import { SketchComparison } from "../components/SketchComparison";
import { assetPath } from "../content/artwork";
import { designCardViewport } from "../drawing/viewport";
import { SketchCanvas } from "../SketchCanvas";
import type { ObservationGroup } from "../content/groups";
import type { ObservationTask } from "../content/tasks";
import type { Stroke } from "../types";

const backgrounds = {
  wave: [
    "やあ、ぼくはピツネ。絵を描くのが大好きなんだ！",
    "こんにちは！",
    "green",
  ],
  book: [
    "ねえ、一緒にスケッチしない？ うまくなくても大丈夫！",
    "やってみる！",
    "green",
  ],
  camera: [
    "まずは、動物の写真を撮ってぼくに見せてね！",
    "撮ってみる！",
    "orange",
  ],
  easel: [
    "ぼくが途中までスケッチしたから、きみの手で完成させてみて！",
    "描いてみる！",
    "orange",
  ],
} as const;

export function ReplicaIntro({
  pose,
  onNext,
}: {
  pose: keyof typeof backgrounds;
  onNext: () => void;
}) {
  const [message, action, color] = backgrounds[pose];
  const folder = "illustrations/pdf-design/";
  return (
    <section
      className="design3-intro"
      aria-label={pose === "easel" ? "スケッチの案内" : "ピツネのあいさつ"}
      data-pose={pose}
      data-figma-art={pose}
      data-entry-lettering={pose}
    >
      <p className="design3-intro-message">
        <img
          alt={message}
          src={assetPath(folder + "entry-" + pose + "-message.svg")}
        />
      </p>
      <img
        alt=""
        className="design3-intro-original"
        src={assetPath(
          pose === "easel"
            ? folder + "pitsune-easel.svg"
            : "figma/entry/" + pose + ".svg",
        )}
      />
      <button
        className="design3-intro-next"
        data-color={color}
        aria-label={action}
        onClick={onNext}
      >
        <img alt="" src={assetPath(folder + "entry-" + pose + "-action.svg")} />
      </button>
    </section>
  );
}

export function ReplicaDifficulty({
  task,
  group,
  onStart,
}: {
  task: ObservationTask;
  group: ObservationGroup;
  onStart: () => void;
}) {
  return (
    <section className="design3-challenge replica-difficulty">
      <h1>
        {task.id === "giraffe" ? (
          <img
            className="design3-challenge-giraffe-title"
            src={assetPath(
              "illustrations/pdf-design/challenge-giraffe-title.svg",
            )}
            alt="キリンの舌"
          />
        ) : (
          <strong>
            {group.name}の{task.part}
          </strong>
        )}
        <img
          className="design3-challenge-prompt"
          src={assetPath("illustrations/pdf-design/challenge-prompt.svg")}
          alt="を描いてみよう！"
        />
      </h1>
      <DifficultyPill regionCount={task.scene.regions.length} />
      <button
        className="replica-fullscreen-action"
        onClick={onStart}
        aria-label="描きはじめる"
      />
    </section>
  );
}

type DrawingProps = Pick<
  ComponentProps<typeof SketchCanvas>,
  "strokes" | "canUndo" | "canRedo" | "onUndo" | "onRedo" | "onChange"
>;

export function ReplicaDraw({
  task,
  showHint,
  onHint,
  onDone,
  ...drawing
}: DrawingProps & {
  task: ObservationTask;
  showHint: boolean;
  onHint: () => void;
  onDone: () => void;
}) {
  return (
    <section className="design3-draw">
      <SketchCanvas
        {...drawing}
        scene={task.scene}
        fixedPortrait
        showTarget={showHint}
        missionTitle={
          showHint
            ? "もうすこし観察してみて！"
            : task.id === "giraffe"
              ? "舌をよく観察してみて！"
              : task.part + "をよく観察してみて！"
        }
        missionLettering={
          showHint
            ? "illustrations/pdf-design/drawing-prompt-hint.svg"
            : task.id === "giraffe"
              ? "illustrations/pdf-design/drawing-prompt-giraffe.svg"
              : undefined
        }
        actions={
          <>
            <button
              className="drawing-pill drawing-pill-green sketch-hint-button"
              onClick={onHint}
              aria-pressed={showHint}
              disabled={showHint}
            >
              <CircleHelp size={18} aria-hidden />
              <img
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-hint.svg",
                )}
                alt="ヒントを見る"
              />
            </button>
            <button
              className="drawing-pill draw-complete"
              onClick={onDone}
              disabled={!drawing.strokes.length}
            >
              <img
                className="drawing-pitsune-icon"
                alt=""
                width={19}
                height={17}
                src={assetPath("figma/entry/sketch-confirm.svg")}
              />
              <img
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-finish.svg",
                )}
                alt="できた！"
              />
            </button>
          </>
        }
      />
      {showHint && task.id !== "giraffe" && (
        <p className="replica-task-hint">{task.hint}</p>
      )}
    </section>
  );
}

export function ReplicaResult({
  task,
  group,
  strokes,
  tutorial,
  saving,
  onRedraw,
  onDone,
}: {
  task: ObservationTask;
  group: ObservationGroup;
  strokes: Stroke[];
  tutorial: boolean;
  saving: boolean;
  onRedraw: () => void;
  onDone: () => void;
}) {
  const fact = task.explanation.ecology || task.explanation.form;

  return (
    <section className="design3-result">
      <div className="result-pitsune">
        <img
          alt=""
          className="result-pitsune-face"
          src={assetPath("figma/entry/sketch-face.svg")}
        />
        <h1 className="pitsune-bubble">
          <img
            className="drawing-lettering"
            src={assetPath(
              "illustrations/pdf-design/drawing-prompt-success.svg",
            )}
            alt="上手に描けたね！"
          />
        </h1>
      </div>
      <SketchComparison
        strokes={strokes}
        scene={task.scene}
        answer={group.answer}
        completed
        initialMode="answer"
        viewport={designCardViewport(task.scene)}
        cardFooter={<p className="result-fact">{fact}</p>}
        afterCard={
          <div className="drawing-actions result-actions">
            <button
              className="drawing-pill drawing-pill-green"
              onClick={onRedraw}
              disabled={saving}
            >
              <img
                className="drawing-lettering"
                src={assetPath("replica-assets/result-redraw.svg")}
                alt="描きなおす"
              />
            </button>
            <button className="drawing-pill" onClick={onDone} disabled={saving}>
              <img
                className="drawing-lettering"
                src={assetPath(
                  tutorial
                    ? "replica-assets/result-next.svg"
                    : "replica-assets/result-camera.svg",
                )}
                alt={tutorial ? "つぎへ" : "写真を撮る"}
              />
            </button>
          </div>
        }
      />
    </section>
  );
}

export const giraffeFact =
  "キリンはアフリカのサバンナにすんでいるよ。今いる動物の中で一番背が高く、オスは5m以上になることもあるんだ。長い首を使って高い木の葉っぱを食べたり、遠くにいる敵を見つけたりするよ。実は、首の骨の数は人間と同じ7個なんだ！";

export function ReplicaPhotoReview({
  photo,
  sample,
  createdAt,
  saved,
  group,
  choices,
  onSelect,
  onRetake,
  onConfirm,
}: {
  photo?: string;
  sample: boolean;
  createdAt?: string;
  saved: boolean;
  group?: ObservationGroup;
  choices: ObservationGroup[];
  onSelect: (id: string) => void;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const edit = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const photoHeading = photo
    ? saved
      ? "写真をアルバムに保存しました。"
      : "撮影した写真を確認する"
    : "観察する動物を選ぶ";
  const file = (name: string) =>
    assetPath("illustrations/pdf-design/camera-review-" + name + ".svg");
  return (
    <section
      className="design3-photo-review"
      aria-labelledby="replica-photo-heading"
    >
      <h1 id="replica-photo-heading">
        {photo && saved ? (
          <img
            src={assetPath("replica-assets/review-title.svg")}
            alt={photoHeading}
          />
        ) : (
          photoHeading
        )}
      </h1>
      <article className="design3-photo-card">
        {photo ? (
          <img
            className="captured-preview"
            src={photo}
            alt={sample ? "見本写真のキリン" : "撮影した動物の写真"}
          />
        ) : (
          <div className="design3-photo-placeholder">
            <img
              alt=""
              src={assetPath("illustrations/pdf-design/camera-placeholder.svg")}
            />
          </div>
        )}
        <div className="design3-photo-meta">
          <div className="design3-photo-animal">
            <h2>
              {group?.id === "giraffe" ? (
                <img
                  src={assetPath("replica-assets/review-giraffe.svg")}
                  alt={group.name}
                />
              ) : (
                (group?.name ?? "？？？？？")
              )}
            </h2>
            <button
              className="design3-photo-edit"
              ref={edit}
              aria-label="修正"
              aria-controls={editing ? optionsId : undefined}
              aria-expanded={editing}
              onClick={() => setEditing(!editing)}
            >
              <img alt="" src={file("edit")} />
            </button>
            {editing && (
              <ul
                id={optionsId}
                className="design3-photo-options"
                aria-label="動物の一覧"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  setEditing(false);
                  edit.current?.focus();
                }}
              >
                {choices.map(({ id, name }) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={group?.id === id}
                      onClick={() => {
                        onSelect(id);
                        setEditing(false);
                        edit.current?.focus();
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {createdAt && (
            <div className="design3-photo-date">
              <span>
                <img alt="" src={file("date")} />
                <time dateTime={createdAt}>
                  {new Date(createdAt).toLocaleDateString("ja-JP")}
                </time>
              </span>
              {sample && (
                <span>
                  <img alt="" src={file("location")} />
                  見本写真
                </span>
              )}
            </div>
          )}
        </div>
        <p className="design3-photo-fact">
          {group?.id === "giraffe" ? (
            <img
              src={assetPath("replica-assets/review-description.svg")}
              alt={giraffeFact}
            />
          ) : (
            (group?.fact ?? "？？？？？")
          )}
        </p>
      </article>
      <div className="design3-actions">
        <button
          className="design3-pill design3-pill--green"
          aria-label="撮りなおす"
          onClick={onRetake}
        >
          <img
            className="photo-review-retake-mark"
            alt=""
            src={file("retake")}
          />
        </button>
        <button
          className="design3-pill"
          aria-label="ピツネに見せる"
          disabled={!group}
          onClick={onConfirm}
        >
          <img
            className="photo-review-confirm-mark"
            alt=""
            src={file("confirm")}
          />
        </button>
      </div>
    </section>
  );
}
