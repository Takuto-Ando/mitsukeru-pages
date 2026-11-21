import {
  penColorsFor,
  sketchPresentationFor,
} from "../content/sketchPresentation";
import { BubbleLine } from "../components/BubbleLine";
import { ZooCardSummary } from "../components/ZooCardSummary";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import { CardLettering, tutorialLines } from "../components/CardLettering";
import { CircleHelp } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { PhotoRecognitionGuide } from "../components/ChallengeIntro";
import { SketchComparison } from "../components/SketchComparison";
import { assetPath } from "../content/artwork";
import { designCardViewport } from "../drawing/viewport";
import { SketchCanvas } from "../SketchCanvas";
import type { ObservationGroup } from "../content/groups";
import type { ObservationTask } from "../content/tasks";
import type { Evaluation, Stroke } from "../types";

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
  onSkip,
}: {
  pose: keyof typeof backgrounds;
  onNext: () => void;
  onSkip?: () => void;
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
      <p className="design3-intro-message" key={pose}>
        <CardLettering
          text={message}
          lines={tutorialLines[pose]}
          src={assetPath(folder + "entry-" + pose + "-message.svg")}
        />
      </p>
      <img
        key={pose}
        alt=""
        className="design3-intro-original"
        src={assetPath(
          pose === "easel"
            ? folder + "pitsune-easel.svg"
            : "figma/entry/" + pose + ".svg",
        )}
      />
      {onSkip && (
        <button className="design3-intro-skip" type="button" onClick={onSkip}>
          スキップ
        </button>
      )}
      <button
        className="design3-intro-next"
        data-color={color}
        aria-label={action}
        onClick={onNext}
      >
        <CardLettering
          text={action}
          src={assetPath(folder + "entry-" + pose + "-action.svg")}
        />
      </button>
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
  const prompt = sketchPresentationFor(task.scene)?.prompt;
  return (
    <section className="design3-draw">
      <SketchCanvas
        key={task.id}
        {...drawing}
        scene={task.scene}
        initialPenColors={penColorsFor(task.groupId)}
        fixedPortrait
        inkBehindArtwork
        showTarget={showHint}
        missionTitle={
          showHint
            ? "もうすこし観察してみて！"
            : (prompt?.text ?? task.part + "をよく観察してみて！")
        }
        missionLettering={
          showHint
            ? "illustrations/pdf-design/drawing-prompt-hint.svg"
            : prompt?.lettering
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
              <CardLettering
                className="drawing-lettering"
                src={assetPath(
                  "illustrations/pdf-design/drawing-action-hint.svg",
                )}
                text="ヒントを見る"
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
  feedback,
  tutorial,
  saving,
  onRedraw,
  canRedraw = true,
  onConfirm,
  onDone,
}: {
  task: ObservationTask;
  group: ObservationGroup;
  strokes: Stroke[];
  feedback: Evaluation;
  tutorial: boolean;
  saving: boolean;
  onRedraw: () => void;
  canRedraw?: boolean;
  onConfirm: () => void;
  onDone: () => void;
}) {
  const fact = zooAnimalSummary(group.id, task.id);

  return (
    <section className="design3-result">
      <div className="result-pitsune">
        <img
          alt=""
          className="result-pitsune-face"
          src={assetPath("figma/entry/sketch-face.svg")}
        />
        <h1 className="pitsune-bubble">
          {feedback.passed && feedback.method === "automatic" ? (
            <CardLettering
              className="drawing-lettering"
              src={assetPath(
                "illustrations/pdf-design/drawing-prompt-success.svg",
              )}
              text="上手に描けたね！"
            />
          ) : (
            <BubbleLine text={feedback.message} />
          )}
        </h1>
      </div>
      <SketchComparison
        strokes={strokes}
        scene={task.scene}
        answer={group.answer}
        completed={feedback.passed}
        initialMode="drawing"
        animateDrawingFor={task.id}
        showReplay={false}
        viewport={designCardViewport(task.scene)}
        cardFooter={
          fact && <ZooCardSummary className="result-fact" text={fact} />
        }
        afterCard={
          <div className="drawing-actions result-actions">
            <button
              className="drawing-pill drawing-pill-green"
              onClick={onRedraw}
              disabled={saving || !canRedraw}
            >
              <CardLettering
                className="drawing-lettering"
                src={assetPath("replica-assets/result-redraw.svg")}
                text="描きなおす"
              />
            </button>
            {feedback.passed && (
              <button
                className="drawing-pill"
                onClick={onDone}
                disabled={saving}
              >
                <CardLettering
                  className="drawing-lettering"
                  src={assetPath(
                    tutorial
                      ? "replica-assets/result-next.svg"
                      : "replica-assets/result-camera.svg",
                  )}
                  text={tutorial ? "つぎへ" : "写真を撮る"}
                />
              </button>
            )}
          </div>
        }
      />
      {!feedback.passed && (
        <div className="self-check">
          {feedback.suggestion && <p>{feedback.suggestion}</p>}
          <button className="primary" onClick={onConfirm}>
            見くらべて、確かめた！
          </button>
        </div>
      )}
    </section>
  );
}

export function ReplicaPhotoReview({
  photo,
  sample,
  createdAt,
  photoLocation,
  saved,
  group,
  choices,
  figmaFlow,
  onSelect,
  onRetake,
  canRetake = true,
  onConfirm,
}: {
  photo?: string;
  sample: boolean;
  createdAt?: string;
  photoLocation?: string;
  saved: boolean;
  group?: ObservationGroup;
  choices: ObservationGroup[];
  figmaFlow?: "tutorial" | "regular";
  onSelect: (id: string) => void;
  onRetake: () => void;
  canRetake?: boolean;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const edit = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const reviewNodes =
    figmaFlow === "tutorial"
      ? { success: "43-1815", unknown: "52-5265", edit: "63-6420" }
      : { success: "66-7554", unknown: "66-7655", edit: "66-7604" };
  const fact = zooAnimalSummary(group?.id);
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
      data-figma-node={
        figmaFlow
          ? reviewNodes[editing ? "edit" : group ? "success" : "unknown"]
          : undefined
      }
      aria-labelledby="replica-photo-heading"
    >
      <h1 id="replica-photo-heading">
        {photo && saved ? (
          <CardLettering
            src={assetPath("replica-assets/review-title.svg")}
            text={photoHeading}
          />
        ) : (
          photoHeading
        )}
      </h1>
      <article
        className="design3-photo-card"
        data-photo-shine={photo ? true : undefined}
      >
        {photo ? (
          <div className="photo-preview-wrap">
            <img
              className="captured-preview"
              src={photo}
              alt={sample ? "見本写真のキリン" : "撮影した動物の写真"}
            />
            {sample && group?.id === "giraffe" && <PhotoRecognitionGuide />}
          </div>
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
              {photoLocation && (
                <span>
                  <img alt="" src={file("location")} />
                  {photoLocation}
                </span>
              )}
            </div>
          )}
        </div>
        {fact && <ZooCardSummary className="design3-photo-fact" text={fact} />}
      </article>
      <div className="design3-actions">
        <button
          className="design3-pill design3-pill--green"
          aria-label="撮りなおす"
          disabled={!canRetake}
          onClick={onRetake}
        >
          <CardLettering
            className="photo-review-retake-mark"
            text="撮りなおす"
            src={file("retake")}
          />
        </button>
        <button
          className="design3-pill"
          aria-label="ピツネに見せる"
          disabled={!group}
          onClick={onConfirm}
        >
          <CardLettering
            className="photo-review-confirm-mark"
            text="ピツネに見せる"
            src={file("confirm")}
          />
        </button>
      </div>
    </section>
  );
}
