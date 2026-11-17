import { useState } from "react";
import { Pitsune, type PitsunePose } from "./Pitsune";

// ピツネの導入（原案: docs/design-reference/pitsune-intro-*.png）
const PAGES: {
  pose: PitsunePose;
  bubble?: string;
  text?: string;
}[] = [
  {
    pose: "stand",
    bubble: "やあ、ぼくは ピツネ！絵を描くのが大好きなんだ。",
  },
  {
    pose: "book",
    bubble: "ねえ、一緒にスケッチしてみない？うまく描けなくても大丈夫！",
  },
  { pose: "camera", bubble: "まずは、動物の写真を撮ってみて！" },
  {
    pose: "easel",
    text: "そしたら、ぼくが途中まで描いてあげる。よ〜く動物を見て描いてみて。",
  },
  {
    pose: "cheer",
    text: "完成したら、スケッチが動きだすよ！動物のヒミツを知ろう！",
  },
];

export function IntroFlow({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const current = PAGES[page];
  const last = page === PAGES.length - 1;
  return (
    <section className="intro-flow" aria-label="ピツネのあいさつ">
      {!last && (
        <button className="intro-skip" onClick={onDone}>
          スキップ
        </button>
      )}
      <div className="intro-stage" key={page}>
        {current.bubble ? (
          <p className="pitsune-bubble intro-bubble">{current.bubble}</p>
        ) : (
          <p className="intro-text">{current.text}</p>
        )}
        <Pitsune pose={current.pose} className="intro-pitsune" />
      </div>
      <div className="intro-dots" aria-hidden="true">
        {PAGES.map((_, index) => (
          <i key={index} className={index === page ? "active" : undefined} />
        ))}
      </div>
      <button
        className="intro-next"
        onClick={() => (last ? onDone() : setPage(page + 1))}
      >
        {last ? "はじめる" : "つぎへ"}
      </button>
    </section>
  );
}
