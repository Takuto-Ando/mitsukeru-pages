import { useLayoutEffect, useRef } from "react";
import { fitTextLine } from "./fitTextLine";
import "../styles/zoo-card-summary.css";

export function ZooCardSummary({
  text,
  className,
  fitLines = false,
}: {
  text: string;
  className?: string;
  fitLines?: boolean;
}) {
  const summaryRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const summary = summaryRef.current;
    if (!fitLines || !summary) return;
    const lines = summary.querySelectorAll<HTMLElement>(
      ".zoo-card-summary-line-text",
    );
    const fit = () => {
      const available = summary.getBoundingClientRect().width;
      for (const line of lines) fitTextLine(line, available);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(summary);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [fitLines, text]);

  return (
    <p className={className}>
      <span className="zoo-card-summary" ref={summaryRef}>
        {text.split("\n").map((line, index) => (
          <span className="zoo-card-summary-line" key={index}>
            {fitLines ? (
              <span className="zoo-card-summary-line-text">{line}</span>
            ) : (
              line
            )}
          </span>
        ))}
      </span>
    </p>
  );
}
