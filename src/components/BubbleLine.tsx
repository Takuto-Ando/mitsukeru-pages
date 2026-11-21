import type { CSSProperties, ReactNode } from "react";
import { Furi } from "../furigana/Furigana";

export function BubbleLine({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
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
        {children ?? <Furi text={text} />}
      </span>
    </span>
  );
}
