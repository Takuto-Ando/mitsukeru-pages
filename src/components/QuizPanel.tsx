import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { groups } from "../content/groups";
import { tasks } from "../content/tasks";
import { artwork, assetPath } from "../content/artwork";
import {
  buildAnimalQuestions,
  buildDifferenceQuestions,
  buildReadingQuestions,
  type AnimalQuestion,
  type DifferenceQuestion,
  type ReadingQuestion,
} from "../future/quizLogic";
import { playMotif, SOUND_QUIZ_IDS } from "../future/soundQuiz";
import { KNOWLEDGE } from "../future/knowledge";
import "../styles/future4.css";

const PRAISE = [
  "すごい！ よく見てるね！",
  "その調子！ 観察名人だね！",
  "ピツネもびっくり！",
];

function corpusTexts(): string[] {
  const texts: string[] = [];
  for (const g of groups) texts.push(g.fact, g.question);
  for (const t of tasks)
    texts.push(t.explanation.form, t.explanation.ecology ?? "");
  return texts;
}

function animalItems(): { name: string; image: string }[] {
  const items: { name: string; image: string }[] = [];
  for (const g of groups) {
    const task = tasks.find((t) => t.groupId === g.id);
    const image = task ? artwork[task.id]?.answer : undefined;
    if (task && image) items.push({ name: g.name, image });
  }
  return items;
}

function diffItems(): { animal: string; part: string; image: string }[] {
  const items: { animal: string; part: string; image: string }[] = [];
  for (const g of groups) {
    const task = tasks.find((t) => t.groupId === g.id);
    const image = task ? artwork[task.id]?.incomplete : undefined;
    if (task && image)
      items.push({ animal: g.name, part: task.part, image });
  }
  return items;
}

type SoundQuestion = { id: string; name: string; choices: string[] };

function buildSoundQuestions(count: number): SoundQuestion[] {
  const ids = [...SOUND_QUIZ_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count).map((id) => {
    const self = groups.find((g) => g.id === id)!;
    const others = SOUND_QUIZ_IDS.filter((o) => o !== id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map((o) => groups.find((g) => g.id === o)!.name);
    const choices = [self.name, ...others].sort(() => Math.random() - 0.5);
    return { id, name: self.name, choices };
  });
}

const ANIMAL_CATEGORIES: { id: string; label: string; groupIds: string[] }[] = [
  { id: "all", label: "すべて", groupIds: groups.map((g) => g.id) },
  { id: "eye", label: "目", groupIds: ["lemur", "goat"] },
  {
    id: "face",
    label: "顔",
    groupIds: ["mandrill", "badger", "hippo", "meerkat"],
  },
  { id: "tail", label: "しっぽ", groupIds: ["capuchin", "fennec", "lemur"] },
  {
    id: "pattern",
    label: "模様・背中",
    groupIds: ["zebra", "deer", "tapir", "bear", "donkey"],
  },
];

type FoodQuestion = { name: string; food: string; choices: string[] };

function buildFoodQuestions(count: number): FoodQuestion[] {
  const entries = groups
    .map((g) => ({ name: g.name, food: KNOWLEDGE[g.id]?.food }))
    .filter((e): e is { name: string; food: string } => !!e.food);
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((entry) => {
    const others = entries
      .filter((e) => e.food !== entry.food)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map((e) => e.food);
    return {
      name: entry.name,
      food: entry.food,
      choices: [entry.food, ...others].sort(() => Math.random() - 0.5),
    };
  });
}

type Mode = "reading" | "animal" | "difference" | "sound" | "food" | "duo";

const BEST_KEY = "zooketch-quiz-best-v1";

function loadBest(): Partial<Record<Mode, number>> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}") as Partial<
      Record<Mode, number>
    >;
  } catch {
    return {};
  }
}

function saveBest(mode: Mode, score: number) {
  const best = loadBest();
  if ((best[mode] ?? -1) < score) {
    best[mode] = score;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      // 保存できなくてもクイズは続行できる
    }
  }
}

export function QuizPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [category, setCategory] = useState("all");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);

  const readingQuestions = useMemo<ReadingQuestion[]>(
    () => (mode === "reading" ? buildReadingQuestions(corpusTexts(), 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );
  const animalQuestions = useMemo<AnimalQuestion[]>(
    () => {
      if (mode !== "animal") return [];
      const cat =
        ANIMAL_CATEGORIES.find((c) => c.id === category) ??
        ANIMAL_CATEGORIES[0];
      const all = animalItems();
      const filtered = all.filter((item) =>
        cat.groupIds.some(
          (id) => groups.find((g) => g.id === id)?.name === item.name,
        ),
      );
      return buildAnimalQuestions(filtered.length >= 3 ? filtered : all, 5);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );
  const diffQuestions = useMemo<DifferenceQuestion[]>(
    () =>
      mode === "difference" ? buildDifferenceQuestions(diffItems(), 5) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );
  const soundQuestions = useMemo<SoundQuestion[]>(
    () => (mode === "sound" ? buildSoundQuestions(5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );
  const foodQuestions = useMemo<FoodQuestion[]>(
    () => (mode === "food" ? buildFoodQuestions(5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );
  const duoQuestions = useMemo<AnimalQuestion[]>(
    () => (mode === "duo" ? buildAnimalQuestions(animalItems(), 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );
  const [duoRevealed, setDuoRevealed] = useState(false);

  const total =
    mode === "reading"
      ? readingQuestions.length
      : mode === "animal"
        ? animalQuestions.length
        : mode === "difference"
          ? diffQuestions.length
          : mode === "sound"
            ? soundQuestions.length
            : mode === "food"
              ? foodQuestions.length
              : mode === "duo"
                ? duoQuestions.length
                : 0;
  const finished = mode !== null && index >= total && total > 0;
  const [best, setBest] = useState<Partial<Record<Mode, number>>>(loadBest);
  useEffect(() => {
    if (finished && mode && (best[mode] ?? -1) < score) {
      saveBest(mode, score);
      setBest(loadBest());
    }
  }, [finished, mode, score, best]);
  const answer =
    mode === "reading"
      ? readingQuestions[index]?.reading
      : mode === "animal"
        ? animalQuestions[index]?.name
        : mode === "difference"
          ? diffQuestions[index]?.part
          : mode === "food"
            ? foodQuestions[index]?.food
            : soundQuestions[index]?.name;
  const choices =
    mode === "reading"
      ? (readingQuestions[index]?.choices ?? [])
      : mode === "animal"
        ? (animalQuestions[index]?.choices ?? [])
        : mode === "difference"
          ? (diffQuestions[index]?.choices ?? [])
          : mode === "food"
            ? (foodQuestions[index]?.choices ?? [])
            : (soundQuestions[index]?.choices ?? []);

  const choose = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    if (choice === answer) setScore((s) => s + 1);
  };
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };
  const restart = () => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDuoRevealed(false);
    setRound((r) => r + 1);
  };

  return (
    <section className="quiz-panel" aria-label="クイズ">
      <div className="quiz-head">
        <h2>クイズであそぼう</h2>
        <button type="button" onClick={onClose} aria-label="クイズを閉じる">
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      {mode === null && (
        <div className="quiz-modes">
          <button type="button" onClick={() => setMode("reading")}>
            よみかたクイズ
            <span>
              漢字の読み方をあてよう
              {best.reading !== undefined &&
                `（ベスト： ${best.reading}もんせいかい）`}
            </span>
          </button>
          <div
            className="quiz-category"
            role="group"
            aria-label="どうぶつあてクイズの部位"
          >
            {ANIMAL_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                className={category === c.id ? "is-active" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMode("animal")}>
            どうぶつあてクイズ
            <span>
              絵を見て動物をあてよう（部位：
              {ANIMAL_CATEGORIES.find((c) => c.id === category)?.label}）
              {best.animal !== undefined &&
                `（ベスト： ${best.animal}もんせいかい）`}
            </span>
          </button>
          <button type="button" onClick={() => setMode("difference")}>
            まちがい探しクイズ
            <span>
              本物と違う部分をあてよう
              {best.difference !== undefined &&
                `（ベスト： ${best.difference}もんせいかい）`}
            </span>
          </button>
          <button type="button" onClick={() => setMode("sound")}>
            音のイメージクイズ
            <span>
              音のモチーフを聞いて動物をあてよう
              {best.sound !== undefined &&
                `（ベスト： ${best.sound}もんせいかい）`}
            </span>
          </button>
          <button type="button" onClick={() => setMode("food")}>
            えさやりクイズ
            <span>
              この動物は何を食べる？
              {best.food !== undefined &&
                `（ベスト： ${best.food}もんせいかい）`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDuoRevealed(false);
              setMode("duo");
            }}
          >
            親子で出し合いクイズ
            <span>出題者は答えを内緒にして、相手に当ててもらおう</span>
          </button>
        </div>
      )}

      {mode !== null && !finished && (
        <div className="quiz-body">
          <p className="quiz-progress">
            {index + 1} / {total} もんめ
          </p>
          {mode === "duo" ? (
            <>
              <img
                className="quiz-image"
                src={assetPath(duoQuestions[index]?.image ?? "")}
                alt="この動物はだあれ？"
              />
              <p className="quiz-question">
                出題者：この動物は だあれ？（答えは内緒だよ）
              </p>
              {duoRevealed ? (
                <div className="quiz-feedback" role="status">
                  <p>こたえは「{duoQuestions[index]?.name}」でした！</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDuoRevealed(false);
                      next();
                    }}
                  >
                    {index + 1 >= total ? "おしまい" : "つぎのもんだい"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setDuoRevealed(true)}>
                  こたえを見る
                </button>
              )}
            </>
          ) : mode === "food" ? (
            <p className="quiz-word">{foodQuestions[index]?.name}</p>
          ) : mode === "reading" ? (
            <p className="quiz-word">{readingQuestions[index]?.word}</p>
          ) : mode === "animal" ? (
            <img
              className="quiz-image"
              src={assetPath(animalQuestions[index]?.image ?? "")}
              alt="この動物はだあれ？"
            />
          ) : mode === "difference" ? (
            <img
              className="quiz-image"
              src={assetPath(diffQuestions[index]?.image ?? "")}
              alt="本物と違うところがある絵"
            />
          ) : (
            <button
              type="button"
              className="sound-play"
              onClick={() =>
                soundQuestions[index] && playMotif(soundQuestions[index].id)
              }
            >
              ▶ 音を聞く
            </button>
          )}
          {mode !== "duo" && (
            <p className="quiz-question">
              {mode === "reading"
                ? "この漢字の読み方は？"
                : mode === "animal"
                  ? "この動物は だあれ？"
                  : mode === "difference"
                    ? `${diffQuestions[index]?.animal} の絵、本物と違うのは どの部分？`
                    : mode === "food"
                      ? "この動物は 何を食べる？"
                      : "この音のイメージは どの動物？（本物の鳴き声ではなく イメージの音だよ）"}
            </p>
          )}
          {mode !== "duo" && (
          <div className="quiz-choices">
            {choices.map((choice) => {
              const state =
                picked === null
                  ? ""
                  : choice === answer
                    ? " is-correct"
                    : choice === picked
                      ? " is-wrong"
                      : "";
              return (
                <button
                  key={choice}
                  type="button"
                  className={"quiz-choice" + state}
                  onClick={() => choose(choice)}
                  disabled={picked !== null}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          )}
          {mode !== "duo" && picked !== null && (
            <div className="quiz-feedback" role="status">
              <p>
                {picked === answer
                  ? "せいかい！ すごいね！"
                  : `おしい！ こたえは「${answer}」だよ`}
              </p>
              <button type="button" onClick={next}>
                {index + 1 >= total ? "けっかを見る" : "つぎのもんだい"}
              </button>
            </div>
          )}
        </div>
      )}

      {finished && mode === "duo" && (
        <div className="quiz-result" role="status">
          <p className="quiz-score">出し合いクイズ おつかれさま！</p>
          <p>こんどは役を交代して遊んでみてね。</p>
          <div className="quiz-result-actions">
            <button type="button" onClick={restart}>
              もういちど
            </button>
            <button type="button" onClick={onClose}>
              ギャラリーにもどる
            </button>
          </div>
        </div>
      )}

      {finished && mode !== "duo" && (
        <div className="quiz-result" role="status">
          <p className="quiz-score">
            {total}もん中 <strong>{score}もん</strong> せいかい！
          </p>
          <p>{PRAISE[Math.min(score, PRAISE.length - 1)]}</p>
          {mode && best[mode] !== undefined && (
            <p className="quiz-best">
              {best[mode] === score && score > 0
                ? "ベストスコア こうしん！"
                : `ベストスコア： ${best[mode]}もんせいかい`}
            </p>
          )}
          <div className="quiz-result-actions">
            <button type="button" onClick={restart}>
              もういちど
            </button>
            <button type="button" onClick={onClose}>
              ギャラリーにもどる
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
