import {
  ArrowRight,
  ChevronDown,
  Eye as EyeIcon,
  RotateCcw,
} from "lucide-react";
import { animalMedia } from "../content/media";
import type { Challenge } from "../types";

export function LearnScreen({
  challenge,
  onRestart,
  onHome,
}: {
  challenge: Challenge;
  onRestart: () => void;
  onHome: () => void;
}) {
  return (
    <section className="explain-page">
      <div className="explain-header">
        <span className="subject-tag">見つけた、かたちのひみつ</span>
        <h1 tabIndex={-1}>
          横長の瞳には、
          <br />
          <span>わけがある。</span>
        </h1>
      </div>
      <div className="science-illustration">
        <div className="view-angle" aria-hidden="true" />
        <img
          src={animalMedia.goat.src}
          alt="左右に視界が広がることを表すヤギの模式イラスト"
        />
        <span className="view-label">まわりを、ひろく。</span>
      </div>
      <div className="explain-copy">
        <p>
          横長の
          <span className="term">
            瞳孔<small>どうこう</small>
          </span>
          は、
          <br />
          地面に沿って周りを広く見渡すのに
          <br />
          役立つと考えられているよ。
        </p>
        <p className="explain-secondary">{challenge.explanation.ecology}</p>
        <small className="diagram-label">
          イラストは働きを伝えるための模式図です。
        </small>
      </div>
      <div className="one-more-look">
        <span>
          <EyeIcon size={23} />
        </span>
        <div>
          <small>もう一度、見てみよう。</small>
          <h2>{challenge.explanation.question}</h2>
        </div>
      </div>
      <button className="primary" onClick={onRestart}>
        <RotateCcw size={19} />
        もう一度、本物の目を見てみよう
        <ArrowRight size={19} />
      </button>
      <button className="text-button" onClick={() => onHome()}>
        はじめの画面へ
      </button>
      <details className="science-source">
        <summary>
          解説の出典
          <ChevronDown size={15} />
        </summary>
        <p>{challenge.explanation.certainty}</p>
        {challenge.scientificSource.map((source) => (
          <a
            href={source.url}
            key={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {source.title} ↗
          </a>
        ))}
      </details>
    </section>
  );
}
