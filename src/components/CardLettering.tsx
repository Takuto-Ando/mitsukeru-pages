import { Furi, useFuriganaEnabled } from "../furigana/Furigana";

export function CardLettering({
  text,
  src,
  className,
  lines,
}: {
  text: string;
  src: string;
  className?: string;
  lines?: readonly string[];
}) {
  const annotated = useFuriganaEnabled() && /[\p{Script=Han}々]/u.test(text);
  if (
    import.meta.env.VITE_LEGACY_EDITIONS === "1" &&
    !annotated &&
    !lines?.length
  ) {
    return <img src={src} alt={text} className={className} />;
  }
  return (
    <span className={["card-lettering", className].filter(Boolean).join(" ")}>
      <img src={src} alt="" aria-hidden="true" />
      <span className="card-lettering-text">
        {lines ? (
          lines.map((line) => (
            <span className="entry-caption-line" key={line}>
              <Furi text={line} />
            </span>
          ))
        ) : (
          <Furi text={text} />
        )}
      </span>
    </span>
  );
}

export const tutorialLines = {
  wave: ["やあ、ぼくはピツネ。", "絵を描くのが大好きなんだ！"],
  book: ["ねえ、一緒にスケッチしない？", "うまくなくても大丈夫！"],
  camera: ["まずは、動物の写真を撮って", "ぼくに見せてね！"],
  easel: ["ぼくが途中までスケッチしたから、", "きみの手で完成させてみて！"],
  loading: ["写真を見ながら", "スケッチを描いています。"],
  finish: ["チュートリアルはこれでおしまい！", "いろんな動物を描きにいこう！"],
};
