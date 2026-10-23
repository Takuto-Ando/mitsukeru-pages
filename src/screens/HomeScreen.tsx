import { AnimalSelector } from "../components/AnimalSelector";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Eye as EyeIcon,
  Heart,
  Pencil,
  Sparkles,
} from "lucide-react";
import { animalMedia } from "../content/media";
import { scope } from "../content/animals";

export function HomeScreen({
  begin,
  onSelect,
}: {
  onSelect: (id: string) => void;
  begin: (next: "camera" | "observe") => void;
}) {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span />
            いつものどうぶつに、新しい発見。
          </p>
          <h1 tabIndex={-1}>
            じっくり見たら、
            <br />
            あっ、<span className="underlined">こんなかたち。</span>
          </h1>
          <p className="hero-description">
            名前を知っている、あのどうぶつ。
            <br />
            でも、目のかたちは覚えてる？
            <br />
            見て、描いて、小さなひみつを見つけよう。
          </p>
          <div className="start-buttons">
            <button className="primary" onClick={() => begin("camera")}>
              <Camera size={21} />
              どうぶつをかざす
              <ArrowRight size={20} />
            </button>
            <button className="manual-start" onClick={() => begin("observe")}>
              <Pencil size={17} />
              ヤギを選んではじめる
              <ArrowRight size={16} />
            </button>
          </div>
          <span className="no-registration">
            カメラがなくても、体験できます。
          </span>
        </div>
        <div className="hero-art">
          <div className="art-sticker">
            <Sparkles size={16} />
            まだ知らない、かたちがある。
          </div>
          <img src={animalMedia.goat.src} alt={animalMedia.goat.alt} />
          <div className="art-note">
            <span className="note-pin" />
            <small>きょうの、かんさつ</small>
            <strong>ヤギの「目」に注目！</strong>
            <span className="note-squiggle">〜〜〜</span>
          </div>
          <span className="placeholder-credit">
            観察イラスト / 写真は準備中
          </span>
        </div>
      </section>
      <AnimalSelector onSelect={onSelect} />
      <section className="experience-intro">
        <span className="section-kicker">発見は、こんなふうに。</span>
        <div className="experience-steps">
          {[
            {
              icon: EyeIcon,
              title: "じっくり、みる",
              text: "目の前のどうぶつを観察。",
              color: "teal",
            },
            {
              icon: Pencil,
              title: "見えたまま、かく",
              text: "空いているところに、指で。",
              color: "orange",
            },
            {
              icon: Sparkles,
              title: "あっ、わかった！",
              text: "かたちに隠れた、ひみつを知る。",
              color: "yellow",
            },
          ].map((step, index) => (
            <div className="experience-step" key={step.title}>
              <span className={"step-icon " + step.color}>
                <step.icon size={25} />
                <small>0{index + 1}</small>
              </span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="gentle-note">
        <Heart size={19} />
        <p>
          絵のじょうずさより、よく見ること。
          <br />
          <span>ちょっとゆがんでも、大丈夫。</span>
        </p>
      </div>
      <details className="about-scope">
        <summary>
          この体験について
          <ChevronDown size={15} />
        </summary>
        <p>
          京都市動物園での観察を想定した、ヤギの体験版です。掲載写真は準備中のため、イラストで案内しています。
        </p>
        <p>{scope.note}対象を推測で増やさず、資料確認後に追加します。</p>
      </details>
    </>
  );
}
