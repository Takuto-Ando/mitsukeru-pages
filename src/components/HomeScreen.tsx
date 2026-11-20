import { BookOpen, Settings } from "lucide-react";
import { groups } from "../content/groups";
import { PitsuneIcon } from "./Pitsune";
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
      <svg
        className="design3-title-tail"
        viewBox="0 0 402 278"
        preserveAspectRatio="xMidYMin slice"
        aria-hidden="true"
      >
        <path
          d="M-6 269C41 273 85 261 110 247"
          fill="none"
          stroke="var(--d3-orange)"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <g className="design3-tail-shape">
          <path
            d="M235-7H410v94c-21 82-90 128-145 149-47 19-98 26-126 13-19-9-24-24-12-43 20-32 47-64 69-106 18-34 30-71 39-107Z"
            fill="var(--d3-orange)"
          />
          <path
            d="M195 101c19 3 33 20 36 40 22 5 37 27 34 51 15 5 27 17 30 33-28 15-60 25-89 29-28 4-52 2-67-5-19-9-24-24-12-43 20-32 47-64 68-105Z"
            fill="#fceacd"
          />
          <path
            d="M159 158c15 2 23 17 19 30 15 5 21 20 19 35 10 6 17 17 16 29-31 6-58 4-74-3-19-9-24-24-12-43 10-16 21-31 32-48Z"
            fill="#805a36"
          />
        </g>
      </svg>
      <div className="design3-title-heading">
        <p>その指先が夢中をつくる。</p>
        <h1>ズーケッチ</h1>
      </div>
      <div className="design3-title-actions">
        <button className="design3-start" onClick={onStart}>
          <PitsuneIcon />
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
      <svg
        className="design3-title-trail"
        viewBox="0 0 180 235"
        aria-hidden="true"
      >
        <path
          d="M177 6C121 32 42 112 8 227"
          fill="none"
          stroke="var(--d3-orange)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray="14 37"
        />
      </svg>
    </section>
  );
}
