import { ArrowRight, ChevronDown, Eye as EyeIcon, Pencil } from "lucide-react";
import { animalMedia } from "../content/media";

export function ObserveScreen({
  photo,
  onDraw,
}: {
  photo: string;
  onDraw: () => void;
}) {
  return (
    <section className="observe-page">
      <div className="observe-copy">
        <span className="subject-tag">ヤギのかんさつ</span>
        <p className="eyebrow">まずは、描く前に。</p>
        <h1 tabIndex={-1}>
          ヤギの目を、
          <br />
          よーく見てみよう。
        </h1>
        <p className="question">
          瞳のまんなかは、
          <br />
          <strong>どんなかたち？</strong>
        </p>
        <p className="quiet-note">
          ヤギ・ヒツジのうち、まずヤギを観察します。ヒツジのお手本は準備中です。
        </p>
        <p className="body-copy">
          まばたきの合間に、そっと観察。
          <br />
          目の中の黒いところに、注目してね。
        </p>
        <button className="primary" onClick={() => onDraw()}>
          <Pencil size={20} />
          見えたかたちを描く
          <ArrowRight size={19} />
        </button>
        <p className="quiet-note">
          見えにくいときは、無理に近づかず待ってみよう。
        </p>
      </div>
      <div className="observation-art">
        <img
          src={animalMedia.goat.src}
          alt="目を観察する前のヤギのイラスト。答えの瞳孔は描いていません。"
        />
        <span className="look-callout">
          <EyeIcon size={20} />
          目の中を、じっくり。
        </span>
      </div>
      {photo && (
        <details className="reference-photo">
          <summary>
            さっきのカメラ写真を見る
            <ChevronDown size={16} />
          </summary>
          <img
            src={photo}
            alt="自分で選んだ観察用写真（動物は自動判別していません）"
          />
        </details>
      )}
    </section>
  );
}
