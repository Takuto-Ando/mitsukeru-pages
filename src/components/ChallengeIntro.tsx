import { ChevronRight } from "lucide-react";
import { DifficultyPill } from "./DifficultyPill";
import { Furi } from "../furigana/Furigana";
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
  tapAnywhere = false,
}: {
  taskId: string;
  animal: string;
  part: string;
  regionCount: number;
  onStart: () => void;
  tapAnywhere?: boolean;
}) {
  const title = taskId === "giraffe" ? "キリンの舌" : `${animal}の${part}`;

  return (
    <section className="design3-challenge">
      <h1 aria-label={`${title}を描いてみよう！`}>
        {taskId === "giraffe" ? (
          <img
            className="design3-challenge-giraffe-title"
            src={assetPath(
              "illustrations/pdf-design/challenge-giraffe-title.svg",
            )}
            alt=""
          />
        ) : (
          <strong>
            <Furi text={title} />
          </strong>
        )}
        <img
          className="design3-challenge-prompt"
          src={assetPath("illustrations/pdf-design/challenge-prompt.svg")}
          alt=""
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
