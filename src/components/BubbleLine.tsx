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
  return (
    <span className="bubble-line">
      <span
        className="bubble-line-text"
        style={
          {
            "--bubble-characters": Array.from(text).length || 1,
          } as CSSProperties
        }
      >
        {children ?? <HighlightedFuri text={text} highlights={highlights} />}
      </span>
    </span>
  );
}
