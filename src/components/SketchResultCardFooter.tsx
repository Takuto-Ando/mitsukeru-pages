import { DifficultyPill } from "./DifficultyPill";
import { ZooCardSummary } from "./ZooCardSummary";
import "./sketch-result-card.css";

export function SketchResultCardFooter({
  title,
  taskId,
  regionCount,
  summary,
}: {
  title: string;
  taskId?: string;
  regionCount: number;
  summary?: string;
}) {
  return (
    <div className="sketch-result-card-footer">
      <div className="sketch-result-card-heading">
        <h2>{title}</h2>
        <DifficultyPill taskId={taskId} regionCount={regionCount} />
      </div>
      {summary && (
        <ZooCardSummary className="sketch-result-card-copy" text={summary} />
      )}
    </div>
  );
}
