/** @jsxImportSource react */
import { createContext, useContext, type ReactNode } from "react";
import { furiganaSegments } from "./tokenize";

// 子ども向けのふりがな表示。設定は App が持ち、Context 経由で各画面に届く。
const FuriganaContext = createContext(true);

export function FuriganaProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <FuriganaContext.Provider value={enabled}>
      {children}
    </FuriganaContext.Provider>
  );
}

export function useFuriganaEnabled(): boolean {
  return useContext(FuriganaContext);
}

const STORAGE_KEY = "zooketch-furigana-v1";

export function loadFurigana(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveFurigana(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // 保存できなくても表示の切り替え自体は有効にする。
  }
}

/** テキストをふりがな付きのノード列に変換する。 */
export function furiganaNodes(text: string): ReactNode[] {
  return furiganaSegments(text).map((segment, index) =>
    segment.reading ? (
      <ruby key={index}>
        {segment.text}
        <rt aria-hidden="true" data-reading={segment.reading} />
      </ruby>
    ) : (
      segment.text
    ),
  );
}

/** ふりがな対象のテキストを表示するコンポーネント。OFF のときは素の文字列。 */
export function Furi({
  text,
  label = true,
}: {
  text: string;
  label?: boolean;
}) {
  const enabled = useFuriganaEnabled();
  if (!enabled || !text) return <>{text}</>;
  return (
    <span aria-label={label ? text : undefined}>{furiganaNodes(text)}</span>
  );
}
