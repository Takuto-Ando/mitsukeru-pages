import { BookOpen, Settings } from "lucide-react";

// タイトル画面（原案: docs/design-reference/title-screen.png）
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
    <section className="home-screen" aria-label="ズーケッチのタイトル">
      <div className="home-heading">
        <div className="home-lockup">
          <svg
            className="home-logo-mark"
            viewBox="0 0 80 80"
            aria-hidden="true"
          >
            <path
              d="M16 47 Q40 63 64 47"
              fill="none"
              stroke="#5b3a1e"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <circle cx="40" cy="38" r="5" fill="#5b3a1e" />
            <path
              d="M13 30 Q40 12 67 30"
              fill="none"
              stroke="#5b3a1e"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray="0.5 8"
            />
            <path
              d="M57 3 q6-3 8 2 l1 9 5-5 q3-3 6 0 q2 3-1 6 l-4 4 q1 12-6 19 q-7 7-15 4 l-3-8 q-2-9 2-16 l5-9z"
              fill="#fff7e6"
            />
          </svg>
          <div className="home-lockup-copy">
            <p className="home-tagline">指先から動物園をおもしろく。</p>
            <h1 className="home-logo">ズーケッチ</h1>
          </div>
        </div>
      </div>
      <div className="home-actions">
        <button className="home-start" onClick={onStart}>
          はじめから
        </button>
        <button className="home-continue" onClick={onContinue}>
          つづきから
        </button>
        <div className="home-sub-actions">
          <button className="home-collection" onClick={onCollection}>
            <BookOpen aria-hidden="true" size={19} />
            <span>図鑑を見る</span>
            {savedCount > 0 && (
              <span
                className="home-card-count"
                aria-label={`${savedCount}枚の観察カード`}
              >
                {savedCount}
              </span>
            )}
          </button>
          <button
            className="home-settings"
            onClick={(event) => onSettings(event.currentTarget)}
          >
            <Settings aria-hidden="true" size={17} />
            設定
          </button>
        </div>
      </div>
    </section>
  );
}
