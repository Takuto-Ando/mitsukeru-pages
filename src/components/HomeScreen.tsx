import { CardLettering } from "./CardLettering";
import { BookOpen, Settings, Sparkles } from "lucide-react";
import { useId, useRef, useState } from "react";
import { groups } from "../content/groups";
import { assetPath } from "../content/artwork";
import { DopaTitleArt } from "./DopaEffects";
import { DopaBar } from "../dopagaki/DopaBar";
import "../styles/design3-entry.css";
import "../styles/login-demo.css";

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
  onScanQr,
}: {
  onStart: (trigger: HTMLButtonElement) => void;
  onContinue?: () => void;
  onCollection: () => void;
  onSettings: (trigger: HTMLButtonElement) => void;
  savedCount: number;
  studyTutorial?: boolean;
  edition?: "plus" | "dopa";
  onScanQr?: () => void;
}) {
  const dopaMode = edition === "dopa";
  const lettering = dopaMode ? "" : "-brown";
  const googleLogo = assetPath("figma/entry/google-g.svg");
  const resumeButton = useRef<HTMLButtonElement>(null);
  const loginDemo = useRef<HTMLDialogElement>(null);
  const loginHeading = useId();
  const [demoFinished, setDemoFinished] = useState(false);

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
          <CardLettering
            text="その指先が夢中をつくる。"
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
          onClick={(event) => onStart(event.currentTarget)}
          aria-label="はじめから"
        >
          <img
            alt=""
            src={assetPath("figma/entry/start.svg")}
            width={38}
            height={35}
          />
          <CardLettering
            className="design3-title-start-lettering"
            text="はじめから"
            src={assetPath("illustrations/pdf-design/entry-title-start.svg")}
          />
        </button>
        <button
          ref={resumeButton}
          type="button"
          className="design3-continue"
          aria-label="つづきから"
          aria-haspopup={onContinue ? undefined : "dialog"}
          onClick={onContinue ?? (() => loginDemo.current?.showModal())}
        >
          {!onContinue && (
            <img
              className="design3-title-resume-mark"
              alt=""
              src={googleLogo}
              width={19.2164}
              height={19.2164}
            />
          )}
          <CardLettering
            className="design3-title-resume-lettering"
            text="つづきから"
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
          {onScanQr && <button onClick={onScanQr}>QRで課題を開く</button>}
        </div>
      </div>
      {!onContinue && (
        <dialog
          ref={loginDemo}
          className="login-demo"
          aria-labelledby={loginHeading}
          onClose={() => {
            setDemoFinished(false);
            resumeButton.current?.focus({ preventScroll: true });
          }}
        >
          <div className="login-demo-heading">
            <img src={googleLogo} width={24} height={24} alt="" />
            <h2 id={loginHeading}>Googleログインのデモ</h2>
          </div>
          {demoFinished ? (
            <p role="status">デモが完了しました。</p>
          ) : (
            <p>サンプルで、ズーケッチへのログインを体験できます。</p>
          )}
          <div className="login-demo-actions">
            {!demoFinished && (
              <button
                type="button"
                className="login-demo-start"
                onClick={() => setDemoFinished(true)}
              >
                サンプルでつづける
              </button>
            )}
            <button type="button" onClick={() => loginDemo.current?.close()}>
              {demoFinished ? "タイトルに戻る" : "閉じる"}
            </button>
          </div>
        </dialog>
      )}
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
