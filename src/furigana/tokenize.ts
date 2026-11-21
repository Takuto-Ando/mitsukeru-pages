import { FURIGANA_READINGS } from "./dictionary";
import generated from "./generated-readings.json";

const readings: Record<string, string> = { ...generated, ...FURIGANA_READINGS };

export type FuriganaSegment = { text: string; reading?: string };

// 辞書キーを長い順に並べた照合用リスト（最長一致）。
const KEYS = Object.keys(readings).sort((a, b) => b.length - a.length);
const BY_FIRST_CHAR = new Map<string, string[]>();
for (const key of KEYS) {
  const list = BY_FIRST_CHAR.get(key[0]);
  if (list) list.push(key);
  else BY_FIRST_CHAR.set(key[0], [key]);
}

/** テキストを「素の文字列」と「ふりがな対象」に分割する（純粋関数）。 */
export function furiganaSegments(text: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  let buffer = "";
  let index = 0;
  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer });
      buffer = "";
    }
  };
  while (index < text.length) {
    const candidates = BY_FIRST_CHAR.get(text[index]);
    let matched: string | undefined;
    if (candidates) {
      for (const key of candidates) {
        if (text.startsWith(key, index)) {
          matched = key;
          break;
        }
      }
    }
    if (matched) {
      flush();
      segments.push({ text: matched, reading: readings[matched] });
      index += matched.length;
    } else {
      buffer += text[index];
      index += 1;
    }
  }
  flush();
  return segments;
}
