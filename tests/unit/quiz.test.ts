import { test, expect } from "vitest";
import {
  buildAnimalQuestions,
  buildReadingQuestions,
  readingQuizPool,
} from "../../src/future/quizLogic";

// 決定的な乱数（テスト用）
function lcg(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const TEXTS = [
  "瞳孔は、目に入る光の量を調節する黒い部分。ヤギでは横長です。",
  "横に広い視野で、草を食べながら周囲の動きに気づきやすくなります。",
  "成長した個体では鼻の両側に盛り上がった溝が見られます。顔の色は年齢や性別でも異なります。",
  "長い腕で枝から枝へ移動します。地上では両腕でバランスをとります。",
  "ワオキツネザルは木の上だけでなく地面にも降ります。尾の輪の模様が名前の由来です。",
];

test("よみかたクイズのプールは解説文に出てくる漢字語だけ", () => {
  const pool = readingQuizPool(TEXTS);
  const words = pool.map((p) => p.word);
  expect(words).toContain("瞳孔");
  expect(words).toContain("調節");
  expect(words).toContain("動物園".length >= 2 ? "周囲" : "");
  // 解説文に出てこない語はプールに入らない
  expect(words).not.toContain("砂漠");
  expect(words).not.toContain("熱帯雨林");
  for (const entry of pool) {
    expect(entry.word.length).toBeGreaterThanOrEqual(2);
    expect(entry.reading.length).toBeGreaterThan(0);
  }
});

test("よみかたクイズは5問・選択肢3つ・正解を含む", () => {
  const questions = buildReadingQuestions(TEXTS, 5, lcg(42));
  expect(questions).toHaveLength(5);
  for (const q of questions) {
    expect(q.choices).toHaveLength(3);
    expect(q.choices).toContain(q.reading);
    expect(new Set(q.choices).size).toBe(3);
  }
});

test("どうぶつあてクイズは名前と画像と選択肢3つ", () => {
  const items = [
    { name: "キリン", image: "a.svg" },
    { name: "ヤギ", image: "b.svg" },
    { name: "カバ", image: "c.svg" },
    { name: "ゾウ", image: "d.svg" },
    { name: "サル", image: "e.svg" },
    { name: "ウマ", image: "f.svg" },
  ];
  const questions = buildAnimalQuestions(items, 5, lcg(7));
  expect(questions).toHaveLength(5);
  for (const q of questions) {
    expect(q.choices).toHaveLength(3);
    expect(q.choices).toContain(q.name);
    expect(items.some((i) => i.image === q.image && i.name === q.name)).toBe(
      true,
    );
  }
});
