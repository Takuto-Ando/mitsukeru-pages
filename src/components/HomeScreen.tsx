import { BookOpen, Settings } from "lucide-react";
import { groups } from "../content/groups";
import { assetPath } from "../content/artwork";
import "../styles/design3-entry.css";

const today = new Date();
const dayIndex = Math.floor(
  Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000,
);
const todaysPick = groups[dayIndex % groups.length];

export function HomeScreen({
  onStart,
  onContinue,
  onCollection,
  onSettings,
  savedCount,
}: {
  onStart: () => void;
  onContinue: () => void;
  onCollection: () => void;
  onSettings: (trigger: HTMLButtonElement) => void;
  savedCount: number;
}) {
  return (
    <section className="design3-title" aria-label="ズーケッチのタイトル">
      <img
        alt=""
        className="design3-title-tail"
        src={assetPath("figma/entry/tail.svg")}
      />
      <img
        alt=""
        className="design3-title-curve"
        src={assetPath("figma/entry/curve.svg")}
      />
      <img
        alt=""
        className="design3-title-trail"
        src={assetPath("figma/entry/trail.svg")}
      />
      <div className="design3-title-heading">
        <p>その指先が夢中をつくる。</p>
        <h1>
          <img alt="ズーケッチ" src={assetPath("figma/entry/logo.svg")} />
        </h1>
      </div>
      <div className="design3-title-actions">
        <button className="design3-start" onClick={onStart}>
          <img
            alt=""
            src={assetPath("figma/entry/start.svg")}
            width={38}
            height={35}
          />
          はじめから
        </button>
        <button className="design3-continue" onClick={onContinue}>
          つづきから
        </button>
      </div>
      <div className="design3-title-meta">
        <p>
          ピツネの今日のおすすめは <strong>{todaysPick.name}</strong> だよ！
        </p>
        <div>
          <button onClick={onCollection}>
            <BookOpen aria-hidden="true" size={17} />
            図鑑を見る
            {savedCount > 0 && (
              <span aria-label={`${savedCount}枚の観察カード`}>
                {savedCount}
              </span>
            )}
          </button>
          <button onClick={(event) => onSettings(event.currentTarget)}>
            <Settings aria-hidden="true" size={17} />
            設定
          </button>
        </div>
      </div>
    </section>
  );
}
