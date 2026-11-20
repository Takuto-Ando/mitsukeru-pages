import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, ChevronRight, Pencil } from "lucide-react";
import { Pitsune, type PitsunePose } from "./Pitsune";
import "../styles/design3-entry.css";
import { assetPath } from "../content/artwork";

const pages = [
  {
    pose: "wave",
    message: (
      <>
        やあ、ぼくは <strong>ピツネ</strong>。
        <br />
        絵を描くのが大好きなんだ！
      </>
    ),
    action: "こんにちは！",
    icon: ChevronRight,
    color: "green",
  },
  {
    pose: "book",
    message: (
      <>
        ねえ、一緒に <strong>スケッチ</strong> しない？
        <br />
        うまくなくても大丈夫！
      </>
    ),
    action: "やってみる！",
    icon: ChevronRight,
    color: "green",
  },
  {
    pose: "camera",
    message: (
      <>
        まずは、<strong>動物の写真</strong> を撮って
        <br />
        ぼくに見せてね！
      </>
    ),
    action: "撮ってみる！",
    icon: Camera,
    color: "orange",
  },
  {
    pose: "easel",
    message: (
      <>
        ぼくが <strong>途中まで</strong> スケッチしたから
        <br />
        きみの手で完成させてみて！
      </>
    ),
    action: "描いてみる！",
    icon: Pencil,
    color: "orange",
  },
] as const;

function IntroPanel({
  label,
  message,
  pose,
  children,
  loading = false,
  artwork,
}: {
  label: string;
  message: ReactNode;
  pose: PitsunePose;
  children?: ReactNode;
  loading?: boolean;
  artwork?: "wave" | "book" | "camera" | "loading" | "easel";
}) {
  return (
    <section
      className="design3-intro"
      aria-label={label}
      data-pose={pose}
      data-figma-art={artwork}
      role={loading ? "status" : undefined}
    >
      <p className="design3-intro-message">{message}</p>
      {artwork ? (
        <img
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

export function IntroFlow({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const current = pages[page];
  const ActionIcon = current.icon;
  return (
    <IntroPanel
      label="ピツネのあいさつ"
      message={current.message}
      pose={current.pose}
      artwork={current.pose}
    >
      <button className="design3-intro-skip" onClick={onDone}>
        スキップ
      </button>
      <button
        className="design3-intro-next"
        data-color={current.color}
        onClick={() =>
          page === pages.length - 1 ? onDone() : setPage(page + 1)
        }
      >
        {current.color === "orange" && <ActionIcon aria-hidden="true" />}
        {current.action}
        {current.color === "green" && <ActionIcon aria-hidden="true" />}
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

export function IntroLoadingScreen() {
  return (
    <IntroPanel
      label="スケッチの準備中"
      message={
        <>
          写真を見ながら
          <br />
          スケッチを描いています。
        </>
      }
      pose="easel"
      artwork="loading"
      loading
    />
  );
}

export function TutorialEndScreen({ onDone }: { onDone: () => void }) {
  return (
    <IntroPanel
      label="チュートリアル終了"
      message={
        <>
          チュートリアルはこれでおしまい！
          <br />
          いろんな動物を描きにいこう！
        </>
      }
      pose="wave"
      artwork="wave"
    >
      <button className="design3-intro-next" onClick={onDone}>
        ありがとう！
        <ChevronRight aria-hidden="true" />
      </button>
    </IntroPanel>
  );
}
