import { ChevronRight, Sparkles, Star } from "lucide-react";
import { useEffect, useRef } from "react";
import { artwork } from "../content/artwork";
import { CardLettering } from "./CardLettering";
import { DifficultyPill } from "./DifficultyPill";
import { Furi } from "../furigana/Furigana";
import { assetPath } from "../content/artwork";

export function PhotoCelebration({ taskId }: { taskId?: string }) {
  const animal =
    taskId === "giraffe"
      ? artwork["giraffe-hoof"].reference
      : taskId && artwork[taskId]?.reference;
  return (
    <section className="design3-photo-celebration" role="status">
      <p>ステキな写真だね！</p>
      <div className="design3-celebration-mascot">
        <img
          alt=""
          src={assetPath("illustrations/pdf-design/pitsune-cheer.svg")}
        />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Star key={index} aria-hidden="true" fill="currentColor" />
        ))}
        {animal && (
          <span className="photo-animal-bubble">
            <img alt="" src={assetPath(animal)} />
          </span>
        )}
      </div>
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
  autoAdvance = false,
}: {
  taskId: string;
  animal: string;
  part: string;
  regionCount: number;
  onStart: () => void;
  tapAnywhere?: boolean;
  autoAdvance?: boolean;
}) {
  const title = taskId === "giraffe" ? "キリンの舌" : `${animal}の${part}`;

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
          <strong>
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
      {tapAnywhere ? (
        <button
          className="design3-challenge-tap"
          type="button"
          aria-label="描きはじめる"
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
