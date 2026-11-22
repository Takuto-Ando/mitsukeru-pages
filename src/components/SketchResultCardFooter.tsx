import { DifficultyPill } from "./DifficultyPill";
import { ZooCardSummary } from "./ZooCardSummary";
import "./sketch-result-card.css";

export function SketchResultCardFooter({
  title,
  regionCount,
  summary,
}: {
  title: string;
  regionCount: number;
  summary?: string;
}) {
  return (
    <div className="sketch-result-card-footer">
      <div className="sketch-result-card-heading">
        <h2>{title}</h2>
        <DifficultyPill regionCount={regionCount} />
      </div>
      {summary && (
        <ZooCardSummary className="sketch-result-card-copy" text={summary} />
      )}
    </div>
  );
}
