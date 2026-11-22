import { ZooCardSummary } from "../components/ZooCardSummary";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import {
  CardLettering,
  tutorialHighlights,
  tutorialLines,
} from "../components/CardLettering";
import { Camera, ChevronRight, CornerDownLeft, Pencil } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PhotoRecognitionGuide } from "../components/ChallengeIntro";
import { assetPath } from "../content/artwork";
import type { ObservationGroup } from "../content/groups";

const backgrounds = {
  wave: [
    "やあ､ぼくは ピツネ。絵を描くのが大好きなんだ！",
    "こんにちは！",
    "green",
  ],
  book: [
    "ねえ､一緒に スケッチ しない？ うまくなくても大丈夫！",
    "やってみる！",
    "green",
  ],
  camera: [
    "まずは､ 動物の写真 を撮ってぼくに見せてね！",
    "撮ってみる！",
    "orange",
  ],
  easel: [
    "ぼくが 途中まで スケッチしたからきみの手で完成させてみて！",
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
  const ActionIcon =
    pose === "camera" ? Camera : pose === "easel" ? Pencil : ChevronRight;
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
          highlights={tutorialHighlights[pose]}
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
        {import.meta.env.VITE_LEGACY_EDITIONS !== "1" && (
          <ActionIcon aria-hidden="true" className="intro-action-icon" />
        )}
      </button>
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
  const animalName = group?.name ?? "？？？？？";
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
      <h1 id="replica-photo-heading">{photoHeading}</h1>
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
            <h2
              style={
                {
                  "--photo-name-length": Array.from(animalName).length,
                } as CSSProperties
              }
            >
              {animalName}
            </h2>
            <button
              className="design3-photo-edit"
              type="button"
              ref={edit}
              aria-label="修正"
              aria-controls={editing ? optionsId : undefined}
              aria-expanded={editing}
              onClick={() => setEditing(!editing)}
            >
              <Pencil
                aria-hidden="true"
                className="photo-review-edit-icon"
                size={8.5}
              />
              <span>修正</span>
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
          <CornerDownLeft aria-hidden="true" width={21} height={20} />
          <span>撮りなおす</span>
        </button>
        <button
          className="design3-pill"
          aria-label="ピツネに見せる"
          disabled={!group}
          onClick={onConfirm}
        >
          <img
            alt=""
            src={assetPath("figma/entry/confirm.svg")}
            width={18.5146}
            height={17}
          />
          <span>ピツネに見せる</span>
        </button>
      </div>
    </section>
  );
}
