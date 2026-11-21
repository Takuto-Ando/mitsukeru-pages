import { FURIGANA_READINGS } from "../furigana/dictionary";

// クイズの問題生成（純粋関数）。乱数は差し替え可能にしてテストできるようにする。
export type Rng = () => number;

function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sample<T>(items: T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, count);
}

const HAS_KANJI = /[一-鿿]/;

export type ReadingQuestion = {
  word: string;
  reading: string;
  choices: string[];
};

/**
 * よみかたクイズの問題プール：ふりがな辞書のうち、実際の解説文・図鑑文に
 * 出てくる2文字以上の漢字語だけを対象にする（習っていない語を出さない）。
 */
export function readingQuizPool(
  texts: string[],
): { word: string; reading: string }[] {
  const corpus = texts.join("\n");
  return Object.entries(FURIGANA_READINGS)
    .filter(
      ([word]) =>
        word.length >= 2 && HAS_KANJI.test(word) && corpus.includes(word),
    )
    .map(([word, reading]) => ({ word, reading }));
}

export function buildReadingQuestions(
  texts: string[],
  count: number,
  rng: Rng = Math.random,
): ReadingQuestion[] {
  const pool = readingQuizPool(texts);
  const picked = sample(pool, Math.min(count, pool.length), rng);
  return picked.map((entry) => {
    const distractors = sample(
      pool.filter((p) => p.reading !== entry.reading),
      2,
      rng,
    ).map((p) => p.reading);
    return {
      word: entry.word,
      reading: entry.reading,
      choices: shuffle([entry.reading, ...distractors], rng),
    };
  });
}

export type AnimalQuestion = {
  image: string;
  name: string;
  choices: string[];
};

export type DifferenceQuestion = {
  image: string;
  animal: string;
  part: string;
  choices: string[];
};

/**
 * まちがい探し：特徴が消えたイラストを見て「本物と違うのはどの部分か」を当てる。
 */
export function buildDifferenceQuestions(
  items: { animal: string; part: string; image: string }[],
  count: number,
  rng: Rng = Math.random,
): DifferenceQuestion[] {
  const picked = sample(items, Math.min(count, items.length), rng);
  return picked.map((item) => {
    const distractors = sample(
      items.filter((i) => i.part !== item.part),
      2,
      rng,
    ).map((i) => i.part);
    return {
      image: item.image,
      animal: item.animal,
      part: item.part,
      choices: shuffle([item.part, ...distractors], rng),
    };
  });
}

export function buildAnimalQuestions(
  items: { name: string; image: string }[],
  count: number,
  rng: Rng = Math.random,
): AnimalQuestion[] {
  const picked = sample(items, Math.min(count, items.length), rng);
  return picked.map((item) => {
    const distractors = sample(
      items.filter((i) => i.name !== item.name),
      2,
      rng,
    ).map((i) => i.name);
    return {
      image: item.image,
      name: item.name,
      choices: shuffle([item.name, ...distractors], rng),
    };
  });
}
