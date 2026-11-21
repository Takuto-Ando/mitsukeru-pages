import { FURIGANA_READINGS } from "./dictionary";

const KANJI_RUN = /[一-鿿]{2,}/g;

/**
 * 辞書カバーチェック：文章中の漢字の連なりを辞書キーで最長一致分割し、
 * 2文字以上のかたまりとして残る（＝ふりがなが付かない）語を返す。
 * 辞書を育てるための開発・保護者向け診断。
 */
export function uncoveredWords(texts: string[]): string[] {
  const keys = Object.keys(FURIGANA_READINGS).sort(
    (a, b) => b.length - a.length,
  );
  const found = new Set<string>();
  for (const text of texts) {
    for (const run of text.match(KANJI_RUN) ?? []) {
      let rest = run;
      while (rest.length >= 2) {
        const hit = keys.find((k) => rest.startsWith(k));
        if (hit) {
          rest = rest.slice(hit.length);
          continue;
        }
        // 先頭2文字を未カバー候補として記録し、1文字進めて再試行する
        found.add(rest.slice(0, 2));
        rest = rest.slice(1);
      }
    }
  }
  return [...found].sort();
}
