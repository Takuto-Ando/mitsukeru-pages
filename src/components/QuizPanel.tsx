import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { groups } from "../content/groups";
import { tasks } from "../content/tasks";
import { artwork, assetPath } from "../content/artwork";
import {
  buildAnimalQuestions,
  buildReadingQuestions,
  type AnimalQuestion,
  type ReadingQuestion,
} from "../future/quizLogic";
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

type Mode = "reading" | "animal";

export function QuizPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
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
    () => (mode === "animal" ? buildAnimalQuestions(animalItems(), 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round],
  );

  const total =
    mode === "reading"
      ? readingQuestions.length
      : mode === "animal"
        ? animalQuestions.length
        : 0;
  const finished = mode !== null && index >= total && total > 0;
  const answer =
    mode === "reading"
      ? readingQuestions[index]?.reading
      : animalQuestions[index]?.name;
  const choices =
    mode === "reading"
      ? (readingQuestions[index]?.choices ?? [])
      : (animalQuestions[index]?.choices ?? []);

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
            <span>漢字の読み方をあてよう</span>
          </button>
          <button type="button" onClick={() => setMode("animal")}>
            どうぶつあてクイズ
            <span>絵を見て動物をあてよう</span>
          </button>
        </div>
      )}

      {mode !== null && !finished && (
        <div className="quiz-body">
          <p className="quiz-progress">
            {index + 1} / {total} もんめ
          </p>
          {mode === "reading" ? (
            <p className="quiz-word">{readingQuestions[index]?.word}</p>
          ) : (
            <img
              className="quiz-image"
              src={assetPath(animalQuestions[index]?.image ?? "")}
              alt="この動物はだあれ？"
            />
          )}
          <p className="quiz-question">
            {mode === "reading"
              ? "この漢字の読み方は？"
              : "この動物は だあれ？"}
          </p>
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
          {picked !== null && (
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

      {finished && (
        <div className="quiz-result" role="status">
          <p className="quiz-score">
            {total}もん中 <strong>{score}もん</strong> せいかい！
          </p>
          <p>{PRAISE[Math.min(score, PRAISE.length - 1)]}</p>
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
