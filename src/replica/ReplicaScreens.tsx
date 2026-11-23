import {
  CardLettering,
  tutorialHighlights,
  tutorialLines,
} from "../components/CardLettering";
import { Camera, ChevronRight, Pencil } from "lucide-react";
import { assetPath } from "../content/artwork";
import { TutorialProgress } from "../components/IntroFlow";

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
  progress,
}: {
  pose: keyof typeof backgrounds;
  onNext: () => void;
  onSkip?: () => void;
  progress?: number;
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
      data-tutorial-step={progress}
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
      {progress && <TutorialProgress step={progress} />}
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
