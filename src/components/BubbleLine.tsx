import type { CSSProperties, ReactNode } from "react";
import { HighlightedFuri } from "../furigana/Furigana";

export function BubbleLine({
  text,
  children,
  highlights,
}: {
  text: string;
  children?: ReactNode;
  highlights?: readonly string[];
}) {
  const characters = Array.from(text).length;
  return (
    <span className="bubble-line">
      <span
        className="bubble-line-text"
        data-tight={characters >= 10 || undefined}
        style={
          {
            "--bubble-characters": characters || 1,
          } as CSSProperties
        }
      >
        {children ?? <HighlightedFuri text={text} highlights={highlights} />}
      </span>
    </span>
  );
}
