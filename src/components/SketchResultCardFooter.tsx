import { useLayoutEffect, useRef } from "react";
import { DifficultyPill } from "./DifficultyPill";
import { fitTextLine } from "./fitTextLine";
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const heading = headingRef.current;
    const text = titleRef.current;
    if (!heading || !text) return;

    const fitTitle = () =>
      fitTextLine(text, heading.getBoundingClientRect().width);

    fitTitle();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitTitle);
    });
    observer.observe(heading);
    observer.observe(text);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [title]);

  return (
    <div className="sketch-result-card-footer">
      <div className="sketch-result-card-heading">
        <h2 ref={headingRef}>
          <span ref={titleRef}>{title}</span>
        </h2>
        <DifficultyPill taskId={taskId} regionCount={regionCount} />
      </div>
      {summary && (
        <ZooCardSummary className="sketch-result-card-copy" text={summary} />
      )}
    </div>
  );
}
