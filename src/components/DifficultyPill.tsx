import { CardLettering } from "./CardLettering";
import { assetPath } from "../content/artwork";
import "../styles/design3-difficulty.css";

export function DifficultyPill({ regionCount }: { regionCount: number }) {
  const difficulty = Math.min(3, regionCount);
  return (
    <span
      className="difficulty-pill"
      role="img"
      aria-label={`難易度 ${difficulty} / 3`}
    >
      <CardLettering
        text="難易度"
        className="difficulty-label"
        src={assetPath("illustrations/pdf-design/difficulty-label.svg")}
      />
      <span className="difficulty-icons" aria-hidden="true">
        {[1, 2, 3].map((level) => (
          <img
            key={level}
            alt=""
            src={assetPath("illustrations/pdf-design/difficulty-mascot.svg")}
            className={level <= difficulty ? "difficulty-active" : undefined}
          />
        ))}
      </span>
    </span>
  );
}
