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
        <div className="home-eye-mark" aria-hidden="true">
          <span>
            <i />
          </span>
          <span>
            <i />
          </span>
        </div>
        <h1 className="home-logo">
          ズー<span>ケッチ</span>
        </h1>
        <p className="home-tagline">よく見て、描いて、あっ！と発見。</p>
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
