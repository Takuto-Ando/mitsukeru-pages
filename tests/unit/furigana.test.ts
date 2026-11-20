import { test, expect } from "vitest";
import { furiganaSegments } from "../../src/furigana/tokenize";

test("熟語は最長一致でまとめて読みが付く", () => {
  const segments = furiganaSegments("目に入る光の量を調節する黒い部分");
  const withReading = segments.filter((s) => s.reading);
  expect(withReading).toContainEqual({ text: "目", reading: "め" });
  expect(withReading).toContainEqual({ text: "光", reading: "ひかり" });
  expect(withReading).toContainEqual({ text: "量", reading: "りょう" });
  expect(withReading).toContainEqual({ text: "調節", reading: "ちょうせつ" });
  expect(withReading).toContainEqual({ text: "黒", reading: "くろ" });
  expect(withReading).toContainEqual({ text: "部分", reading: "ぶぶん" });
});

test("動物園は単漢字に分解されず熟語で読む", () => {
  const segments = furiganaSegments("京都市動物園で観察しよう");
  expect(segments).toContainEqual({ text: "京都市", reading: "きょうとし" });
  expect(segments).toContainEqual({ text: "動物園", reading: "どうぶつえん" });
  expect(segments).toContainEqual({ text: "観察", reading: "かんさつ" });
});

test("瞳孔は どうこう と読む", () => {
  const segments = furiganaSegments("横長の瞳孔");
  expect(segments).toContainEqual({ text: "横長", reading: "よこなが" });
  expect(segments).toContainEqual({ text: "瞳孔", reading: "どうこう" });
});

test("かなだけの文はそのまま返る", () => {
  expect(furiganaSegments("ピツネと いっしょに かこう")).toEqual([
    { text: "ピツネと いっしょに かこう" },
  ]);
});

test("分割しても元の文字列と一致する", () => {
  const source =
    "アカゲザルは木の上と地面の両方で生活し、果実や若葉、昆虫などを食べます。";
  const joined = furiganaSegments(source)
    .map((s) => s.text)
    .join("");
  expect(joined).toBe(source);
});
