import { ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { CardLettering } from "./CardLettering";
import { DifficultyPill } from "./DifficultyPill";
import { Furi } from "../furigana/Furigana";
import { assetPath } from "../content/artwork";

export function PhotoCelebration({
  onContinue,
}: {
  taskId?: string;
  onContinue?: () => void;
}) {
  return (
    <section className="design3-photo-celebration" role="status">
      <p>ステキな写真だね！</p>
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
          aria-label="つぎへ"
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
  hideAction = false,
}: {
  taskId: string;
  animal: string;
  part: string;
  regionCount: number;
  onStart: () => void;
  tapAnywhere?: boolean;
  tapLabel?: string;
  autoAdvance?: boolean;
  hideAction?: boolean;
}) {
  const title = taskId === "giraffe" ? "キリンの舌" : `${animal}の${part}`;

  const titleSize = {
    "--challenge-title-size": `calc(min(82vw, 328px) / ${Array.from(title).length})`,
  } as CSSProperties;
  const start = useRef(onStart);
  start.current = onStart;

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = window.setTimeout(() => start.current(), 3000);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, taskId]);

  return (
    <section className="design3-challenge">
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
      <DifficultyPill regionCount={regionCount} />
      {hideAction ? null : tapAnywhere ? (
        <button
          className="design3-challenge-tap"
          type="button"
          aria-label={tapLabel}
          onClick={onStart}
        />
      ) : (
        <button
          className="design3-pill design3-challenge-start"
          type="button"
          onClick={onStart}
        >
          描きはじめる
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
