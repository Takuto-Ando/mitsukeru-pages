import { useState } from "react";
import type { ObservationGroup } from "../content/groups";
import type { Stroke } from "../types";
import { SketchCanvas } from "../SketchCanvas";
import { Sketch } from "../Illustrations";
export function OtherObservation({
  group,
  photo,
  onHome,
}: {
  group: ObservationGroup;
  photo: string;
  onHome: () => void;
}) {
  const [phase, setPhase] = useState<"draw" | "compare" | "learn">("draw");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  return (
    <div className="app-shell">
      <header className="header">
        <button onClick={onHome}>動物選択へ戻る</button>
        <strong>{group.name}</strong>
      </header>
      <main className="main">
        <h1>
          {group.name}の{group.part}を観察
        </h1>
        <p>{group.question}</p>
        <p className="quiet-note">
          観察の問いは提案です。お手本・判定・部位の働きの確認状況は以下に示します。
        </p>
        <img
          className="selected-photo"
          src={
            import.meta.env.BASE_URL +
            (group.media?.path || "illustrations/animal-placeholder.svg")
          }
          alt={group.media?.alt || "写真未提供のプレースホルダー"}
        />
        {group.media?.credit && <small>{group.media.credit}</small>}
        {photo && (
          <details className="reference-photo">
            <summary>観察写真を見る（選択した動物か確認してね）</summary>
            <img src={photo} alt="自分で選んだ観察用写真" />
          </details>
        )}
        {phase === "draw" ? (
          <>
            <p className="quiet-note">
              この課題の自動判定は未対応です。見えた形を描き、自分で確かめます。
            </p>
            <SketchCanvas
              strokes={strokes}
              onChange={setStrokes}
              template="blank"
            />
            <button
              className="primary"
              disabled={!strokes.length}
              onClick={() => setPhase("compare")}
            >
              描いた形を確かめる
            </button>
          </>
        ) : (
          <>
            <div className="generic-sketch">
              <Sketch strokes={strokes} />
            </div>
            {phase === "compare" ? (
              <>
                <p>あなたが観察して描いた線です。</p>
                <p role="status">
                  この部位のお手本は準備中です。自動で正解とは判定していません。本物と見比べてみよう。
                </p>
                <button className="primary" onClick={() => setPhase("learn")}>
                  分かっていることを見る
                </button>
                <button
                  className="text-button"
                  onClick={() => setPhase("draw")}
                >
                  線を描き足す
                </button>
              </>
            ) : (
              <>
                <h2>観察の手がかり</h2>
                <p>{group.fact}</p>
                <p>
                  解説状態：
                  {group.explanationStatus === "verified"
                    ? "公式図鑑で確認済み"
                    : "指定部位の働きは未確認を含みます"}
                </p>
                {group.source && (
                  <a href={group.source} target="_blank" rel="noreferrer">
                    京都市動物園の出典
                  </a>
                )}
                <button className="primary" onClick={() => setPhase("draw")}>
                  もう一度、本物を観察する
                </button>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
