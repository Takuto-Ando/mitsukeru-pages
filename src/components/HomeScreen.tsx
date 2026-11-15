import { BookOpen, Camera, Settings } from "lucide-react";
import { assetPath, artwork } from "../content/artwork";

export function HomeScreen({
  onStart,
  onCollection,
  onSettings,
  savedCount,
}: {
  onStart: () => void;
  onCollection: () => void;
  onSettings: (trigger: HTMLButtonElement) => void;
  savedCount: number;
}) {
  return (
    <section className="home-screen" aria-label="ズーケッチのホーム">
      <div className="home-heading">
        <div className="home-lockup">
          <svg
            className="home-logo-mark"
            viewBox="0 0 80 80"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="3"
              width="74"
              height="74"
              rx="16"
              fill="var(--color-mustard)"
            />
            <path
              d="M12 45h54v19H12a9 9 0 0 1-9-9v-1a9 9 0 0 1 9-9Z"
              fill="var(--color-teal)"
            />
            <path d="m66 45 12 9-12 10Z" fill="#f7dca8" />
            <path d="m75 52 3 2-3 2Z" fill="var(--color-ink)" />
            <circle cx="40" cy="31" r="7" fill="var(--color-ink)" />
            <path
              d="M13 39c5 20 21 10 27 4 6 6 22 16 27-4"
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="7 5"
            />
          </svg>
          <div className="home-lockup-copy">
            <p className="home-tagline">指先から動物園をおもしろく。</p>
            <h1 className="home-logo">ズーケッチ</h1>
          </div>
        </div>
      </div>
      <div className="home-observation-cards" aria-hidden="true">
        {(
          [
            ["zebra", "ひづめ"],
            ["goat", "ひとみ"],
            ["giraffe", "した"],
          ] as const
        ).map(([id, label]) => (
          <div className={`home-animal-card home-animal-card--${id}`} key={id}>
            <span>{label}</span>
            <img
              src={assetPath(artwork[id].reference!)}
              alt=""
              width="600"
              height="600"
              decoding="async"
            />
          </div>
        ))}
      </div>
      <p className="home-invitation">
        動物の絵のつづきを、
        <br />
        きみの発見で描いてみよう。
      </p>
      <div className="home-actions">
        <button className="home-start" onClick={onStart}>
          <Camera aria-hidden="true" size={22} />
          <span>撮影スタート</span>
          <span aria-hidden="true">→</span>
        </button>
        <button className="home-collection" onClick={onCollection}>
          <BookOpen aria-hidden="true" size={21} />
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
          <Settings aria-hidden="true" size={18} />
          設定
        </button>
      </div>
    </section>
  );
}
