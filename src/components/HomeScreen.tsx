import { BookOpen, Settings, Sparkles } from "lucide-react";
import { groups } from "../content/groups";
import { assetPath } from "../content/artwork";
import { DopaTitleArt } from "./DopaEffects";
import { DopaBar } from "../dopagaki/DopaBar";
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
  studyTutorial = false,
  edition,
}: {
  onStart: () => void;
  onContinue: () => void;
  onCollection: () => void;
  onSettings: (trigger: HTMLButtonElement) => void;
  savedCount: number;
  studyTutorial?: boolean;
  edition?: "plus" | "dopa";
}) {
  const dopaMode = edition === "dopa";
  const lettering = dopaMode ? "" : "-brown";

  return (
    <section className="design3-title" aria-label="ズーケッチのタイトル">
      {dopaMode ? (
        <>
          <span className="dopa-edition-label">
            <Sparkles size={17} aria-hidden="true" />
            ドパガキモード
          </span>
          <DopaTitleArt />
        </>
      ) : (
        <>
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
        </>
      )}
      <div className="design3-title-heading">
        <p className="design3-title-tagline">
          <img
            alt="その指先が夢中をつくる。"
            src={assetPath(
              `illustrations/pdf-design/entry-title-tagline${lettering}.svg`,
            )}
          />
        </p>
        <h1>
          <img
            alt="ズーケッチ"
            src={assetPath(`figma/entry/logo${lettering}.svg`)}
          />
        </h1>
      </div>
      <div className="design3-title-actions">
        <button
          className="design3-start"
          onClick={onStart}
          aria-label="はじめから"
        >
          <img
            alt=""
            src={assetPath("figma/entry/start.svg")}
            width={38}
            height={35}
          />
          <img
            className="design3-title-start-lettering"
            alt=""
            src={assetPath("illustrations/pdf-design/entry-title-start.svg")}
          />
        </button>
        <button
          className="design3-continue"
          onClick={onContinue}
          aria-label="つづきから"
        >
          <img
            className="design3-title-resume-lettering"
            alt=""
            src={assetPath("illustrations/pdf-design/entry-title-resume.svg")}
          />
        </button>
        {dopaMode && <DopaBar />}
      </div>
      <div className="design3-title-meta">
        {studyTutorial && (
          <p className="design3-title-survey-notice">
            チュートリアルのあと、Googleフォームが開きます。
          </p>
        )}
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
      {edition && (
        <nav className="design3-title-editions" aria-label="版の切り替え">
          <a href={assetPath("figma/")}>Figma再現版を開く</a>
          <a href={assetPath(dopaMode ? "plus/" : "dopa/")}>
            {dopaMode ? "機能拡張版を開く" : "ドパガキ版を開く"}
          </a>
        </nav>
      )}
    </section>
  );
}
