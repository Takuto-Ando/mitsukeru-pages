import "../styles/zoo-card-summary.css";

export function ZooCardSummary({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p className={className}>
      <span className="zoo-card-summary">
        {text.split("\n").map((line, index) => (
          <span className="zoo-card-summary-line" key={index}>
            {line}
          </span>
        ))}
      </span>
    </p>
  );
}
