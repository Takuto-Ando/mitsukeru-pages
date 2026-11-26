import { ChevronRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { CardLettering } from "./CardLettering";
import { DifficultyPill } from "./DifficultyPill";
import { Furi } from "../furigana/Furigana";
import { assetPath } from "../content/artwork";
import { challengeTitle } from "../content/challengeTitle";

export function PhotoCelebration({
  onContinue,
}: {
  taskId?: string;
  onContinue?: () => void;
}) {
  return <Celebration message="ステキな写真だね！" onContinue={onContinue} />;
}

export function SketchCelebration({ onContinue }: { onContinue: () => void }) {
  return (
    <Celebration
      message="上手に描けたね！"
      purpose="sketch"
      onContinue={onContinue}
    />
  );
}

function Celebration({
  message,
  purpose,
  onContinue,
}: {
  message: string;
  purpose?: "sketch";
  onContinue?: () => void;
}) {
  return (
    <section
      className="design3-photo-celebration"
      data-purpose={purpose}
      role="status"
    >
      <p>{purpose === "sketch" ? <Furi text={message} /> : message}</p>
      <div className="design3-celebration-mascot">
        <img
          alt=""
          src={assetPath("illustrations/pdf-design/pitsune-photo-cheer.svg")}
        />
        {(["left", "right"] as const).map((side) => (
          <img
            key={side}
            alt=""
            className="photo-celebration-stars"
            data-side={side}
            src={assetPath(
              `illustrations/pdf-design/pitsune-cheer-stars-${side}.svg`,
            )}
          />
        ))}
      </div>
      {onContinue && (
        <button
          type="button"
          className="photo-celebration-tap"
          aria-label={purpose === "sketch" ? "スケッチの結果を見る" : "つぎへ"}
          onClick={onContinue}
        />
      )}
    </section>
  );
}

export function PhotoSparkle() {
  return (
    <span className="photo-sparkle" aria-hidden="true">
      <Sparkles size={21} /> きらりん！
    </span>
  );
}

export function PhotoRecognitionGuide() {
  return (
    <img
      className="design3-camera-guides photo-recognition-guide"
      alt=""
      src={assetPath("figma/entry/camera-guides.svg")}
    />
  );
}

export function ChallengeIntro({
  taskId,
  animal,
  part,
  regionCount,
  onStart,
  tapAnywhere = false,
  tapLabel = "描きはじめる",
  autoAdvance = false,
}: {
  taskId: string;
  animal: string;
  part: string;
  regionCount: number;
  onStart: () => void;
  tapAnywhere?: boolean;
  tapLabel?: string;
  autoAdvance?: boolean;
}) {
  const title = challengeTitle(taskId, animal, part);

  const titleSize = {
    "--challenge-title-size": `calc(min(82vw, 328px) / ${Array.from(title).length})`,
  } as CSSProperties;
  const start = useRef(onStart);
  start.current = onStart;
  const startedTask = useRef<string | undefined>(undefined);
  const proceed = useCallback(() => {
    if (startedTask.current === taskId) return;
    startedTask.current = taskId;
    start.current();
  }, [taskId]);

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(proceed, 3000);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, proceed]);

  return (
    <section className="design3-challenge">
      {import.meta.env.VITE_LEGACY_EDITIONS !== "1" && (
        <p className="design3-challenge-lead">
          <Furi text="＼ 次は君の番だよ！／" />
        </p>
      )}
      <h1
        data-auto-advance={autoAdvance || undefined}
        aria-label={`${title}を描いてみよう！`}
      >
        {taskId === "giraffe" ? (
          <CardLettering
            text={title}
            className="design3-challenge-giraffe-title"
            src={assetPath(
              "illustrations/pdf-design/challenge-giraffe-title.svg",
            )}
          />
        ) : (
          <strong style={titleSize}>
            <Furi text={title} />
          </strong>
        )}
        <CardLettering
          text="を描いてみよう！"
          className="design3-challenge-prompt"
          src={assetPath("illustrations/pdf-design/challenge-prompt.svg")}
        />
      </h1>
      <DifficultyPill regionCount={regionCount} taskId={taskId} />
      {tapAnywhere ? (
        <button
          className="design3-challenge-tap"
          type="button"
          aria-label={tapLabel}
          onClick={proceed}
        />
      ) : (
        <button
          className="design3-pill design3-challenge-start"
          type="button"
          onClick={proceed}
        >
          描きはじめる
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
