import { useEffect, useRef, useState, type ReactNode } from "react";
import { CardLettering, tutorialLines } from "./CardLettering";
import { ChevronRight } from "lucide-react";
import { Pitsune, type PitsunePose } from "./Pitsune";
import "../styles/design3-entry.css";
import { assetPath } from "../content/artwork";

// Fixed lettering uses the supplied PDF's vector outlines. The text remains
// accessible as Japanese through alt text and button names.
const pages = [
  {
    pose: "wave",
    message: "やあ、ぼくはピツネ。絵を描くのが大好きなんだ！",
    action: "こんにちは！",
    color: "green",
  },
  {
    pose: "book",
    message: "ねえ、一緒にスケッチしない？ うまくなくても大丈夫！",
    action: "やってみる！",
    color: "green",
  },
  {
    pose: "camera",
    message: "まずは、動物の写真を撮ってぼくに見せてね！",
    action: "撮ってみる！",
    color: "orange",
  },
  {
    pose: "easel",
    message: "ぼくが途中までスケッチしたから、きみの手で完成させてみて！",
    action: "描いてみる！",
    color: "orange",
  },
] as const;

type EntryLettering = (typeof pages)[number]["pose"] | "loading" | "finish";

function entryLettering(screen: EntryLettering, kind: "message" | "action") {
  return assetPath(
    "illustrations/pdf-design/entry-" + screen + "-" + kind + ".svg",
  );
}

function IntroPanel({
  label,
  message,
  pose,
  children,
  loading = false,
  artwork,
  lettering,
}: {
  label: string;
  message: ReactNode;
  pose: PitsunePose;
  children?: ReactNode;
  loading?: boolean;
  artwork?: "wave" | "book" | "camera" | "loading" | "easel";
  lettering?: EntryLettering;
}) {
  return (
    <section
      className="design3-intro"
      aria-label={label}
      data-pose={pose}
      data-figma-art={artwork}
      data-entry-lettering={lettering}
      role={loading ? "status" : undefined}
    >
      <p key={lettering} className="design3-intro-message">
        {lettering && typeof message === "string" ? (
          <CardLettering
            text={message}
            src={entryLettering(lettering, "message")}
            lines={tutorialLines[lettering]}
          />
        ) : (
          message
        )}
      </p>
      {artwork === "loading" ? (
        <picture className="design3-intro-picture">
          <source
            media="(prefers-reduced-motion: reduce)"
            srcSet={assetPath("figma/entry/loading.svg")}
          />
          <img
            alt=""
            className="design3-intro-original"
            src={assetPath("illustrations/pdf-design/pitsune-easel.svg")}
          />
        </picture>
      ) : artwork ? (
        <img
          key={artwork}
          alt=""
          className="design3-intro-original"
          src={assetPath(
            artwork === "easel"
              ? "illustrations/pdf-design/pitsune-easel.svg"
              : `figma/entry/${artwork}.svg`,
          )}
        />
      ) : (
        <Pitsune pose={pose} className="design3-intro-pitsune" />
      )}
      {children}
    </section>
  );
}

export function IntroFlow({
  onDone,
}: {
  onDone: (completed: boolean) => void;
}) {
  const [page, setPage] = useState(0);
  const current = pages[page];
  return (
    <IntroPanel
      label="ピツネのあいさつ"
      message={current.message}
      pose={current.pose}
      artwork={current.pose}
      lettering={current.pose}
    >
      <button className="design3-intro-skip" onClick={() => onDone(false)}>
        スキップ
      </button>
      <button
        className="design3-intro-next"
        data-color={current.color}
        aria-label={current.action}
        onClick={() =>
          page === pages.length - 1 ? onDone(true) : setPage(page + 1)
        }
      >
        <CardLettering
          text={current.action}
          src={entryLettering(current.pose, "action")}
        />
      </button>
    </IntroPanel>
  );
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDoneRef.current();
      return;
    }
    const timeout = window.setTimeout(() => onDoneRef.current(), 900);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <button
      className="design3-splash"
      onClick={onDone}
      aria-label="スプラッシュをスキップ"
    >
      <img
        alt=""
        className="design3-splash-original"
        src={assetPath("illustrations/pdf-design/pitsune-stand.svg")}
      />
    </button>
  );
}

export function IntroLoadingScreen({
  onContinue,
}: { onContinue?: () => void } = {}) {
  return (
    <IntroPanel
      label="スケッチの準備中"
      message="写真を見ながらスケッチを描いています。"
      pose="easel"
      artwork="loading"
      lettering="loading"
      loading
    >
      {onContinue && (
        <button
          type="button"
          className="design3-challenge-tap"
          aria-label="スケッチの準備を確認してつぎへ"
          onClick={onContinue}
        />
      )}
    </IntroPanel>
  );
}

export function TutorialEndScreen({
  onDone,
  surveyUrl,
}: {
  onDone: () => void;
  surveyUrl?: string;
}) {
  return (
    <IntroPanel
      label="チュートリアル終了"
      message={
        surveyUrl ? (
          <>
            <span className="entry-caption-line">
              チュートリアルはこれでおしまい！
            </span>
            <span className="entry-caption-line">
              Googleフォームで感想を聞かせてね。
            </span>
          </>
        ) : (
          "チュートリアルはこれでおしまい！ いろんな動物を描きにいこう！"
        )
      }
      pose="wave"
      artwork="wave"
      lettering={surveyUrl ? undefined : "finish"}
    >
      {surveyUrl ? (
        <div className="design3-survey-actions">
          <a className="design3-intro-next" href={surveyUrl} rel="noreferrer">
            アンケートを開く
            <ChevronRight aria-hidden="true" />
          </a>
          <button className="text-button" onClick={onDone}>
            ホームに戻る
          </button>
        </div>
      ) : (
        <button
          className="design3-intro-next"
          onClick={onDone}
          aria-label="ありがとう！"
        >
          <CardLettering
            text="ありがとう！"
            src={entryLettering("finish", "action")}
          />
          {import.meta.env.VITE_LEGACY_EDITIONS !== "1" && (
            <ChevronRight aria-hidden="true" className="intro-action-icon" />
          )}
        </button>
      )}
    </IntroPanel>
  );
}
