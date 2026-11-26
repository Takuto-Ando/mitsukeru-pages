import { HighlightedFuri, useFuriganaEnabled } from "../furigana/Furigana";

export function CardLettering({
  text,
  src,
  className,
  lines,
  highlights,
}: {
  text: string;
  src?: string;
  className?: string;
  lines?: readonly string[];
  highlights?: readonly string[];
}) {
  const annotated = useFuriganaEnabled() && /[\p{Script=Han}々]/u.test(text);
  if (
    src &&
    import.meta.env.VITE_LEGACY_EDITIONS === "1" &&
    !annotated &&
    !lines?.length
  ) {
    return <img src={src} alt={text} className={className} />;
  }
  return (
    <span className={["card-lettering", className].filter(Boolean).join(" ")}>
      {src && <img src={src} alt="" aria-hidden="true" />}
      <span className="card-lettering-text">
        {lines ? (
          lines.map((line) => (
            <span className="entry-caption-line" key={line}>
              <HighlightedFuri text={line} highlights={highlights} />
            </span>
          ))
        ) : (
          <HighlightedFuri text={text} highlights={highlights} />
        )}
      </span>
    </span>
  );
}

export const tutorialLines = {
  wave: ["やあ､ぼくは ピツネ。", "しっぽを使って絵を描くんだ！"],
  book: ["ねえ､一緒に スケッチ しない？", "描いた部分が動きだすよ！"],
  camera: ["まずは 動物の写真 を撮ってきて！", "ぼくが､途中まで描いてあげる！"],
  cameraLoading: ["まずは､ 動物の写真 を撮って", "ぼくに見せてね！"],
  easel: ["動物を よーく観察 して、", "ぼくのスケッチを", "完成させてみて！"],
  loading: ["写真を見ながら", "スケッチを描いています。"],
  finish: ["チュートリアルはこれでおしまい！", "さあ､動物たちを描きにいこう！"],
};

export const tutorialHighlights = {
  wave: ["ピツネ"],
  book: ["スケッチ"],
  camera: ["動物の写真"],
  easel: ["よーく観察"],
};
