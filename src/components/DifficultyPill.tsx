import { PitsuneIcon } from "./Pitsune";
import "../styles/design3-difficulty.css";

export function DifficultyPill({ regionCount }: { regionCount: number }) {
  const difficulty = Math.min(3, regionCount);
  return (
    <span
      className="difficulty-pill"
      role="img"
      aria-label={`難易度 ${difficulty} / 3`}
    >
      難易度
      <span className="difficulty-icons" aria-hidden="true">
        {[1, 2, 3].map((level) => (
          <PitsuneIcon
            key={level}
            className={level <= difficulty ? "difficulty-active" : undefined}
          />
        ))}
      </span>
    </span>
  );
}
