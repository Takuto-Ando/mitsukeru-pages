import { ChevronRight } from "lucide-react";
import { DifficultyPill } from "./DifficultyPill";
import { assetPath } from "../content/artwork";

export function PhotoCelebration() {
  return (
    <section className="design3-photo-celebration" role="status">
      <p>ステキな写真だね！</p>
      <div className="design3-celebration-mascot">
        <img
          alt=""
          src={assetPath("illustrations/pdf-design/pitsune-cheer.svg")}
        />
      </div>
    </section>
  );
}

export function ChallengeIntro({
  taskId,
  animal,
  part,
  regionCount,
  onStart,
}: {
  taskId: string;
  animal: string;
  part: string;
  regionCount: number;
  onStart: () => void;
}) {
  return (
    <section className="design3-challenge">
      <h1>
        {taskId === "giraffe" ? (
          <img
            className="design3-challenge-giraffe-title"
            src={assetPath(
              "illustrations/pdf-design/challenge-giraffe-title.svg",
            )}
            alt="キリンの舌"
          />
        ) : (
          <strong>
            {animal}の{part}
          </strong>
        )}
        <img
          className="design3-challenge-prompt"
          src={assetPath("illustrations/pdf-design/challenge-prompt.svg")}
          alt="を描いてみよう！"
        />
      </h1>
      <DifficultyPill regionCount={regionCount} />
      <button
        className="design3-pill design3-challenge-start"
        onClick={onStart}
      >
        描きはじめる
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </section>
  );
}
