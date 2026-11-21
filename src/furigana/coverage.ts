import { furiganaSegments } from "./tokenize";

const kanji = /[\p{Script=Han}々]+/gu;

/** Finds characters missing a reading in the same dictionary used by the UI. */
export function uncoveredWords(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const segment of furiganaSegments(text)) {
      if (segment.reading) continue;
      for (const word of segment.text.match(kanji) ?? []) found.add(word);
    }
  }
  return [...found].sort();
}
