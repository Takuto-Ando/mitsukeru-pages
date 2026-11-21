import type { ObservationRecord } from "../notebook/types";

// 自由研究ポスター：観察カード1枚を A4 ポスター形式に整形して印刷する。
export function PosterPrint({
  drawing,
  ownUrl,
}: {
  drawing: ObservationRecord;
  ownUrl?: string;
}) {
  const date = new Date(drawing.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="poster-print">
      <p className="poster-kicker">じゆうけんきゅう</p>
      <h2>
        {drawing.animalName} の {drawing.taskName} を調べたよ
      </h2>
      <p className="poster-date">{date}・京都市動物園</p>
      {ownUrl && (
        <img className="poster-image" src={ownUrl} alt="自分の観察スケッチ" />
      )}
      <h3>わかったこと</h3>
      <p>{drawing.explanation.form}</p>
      {drawing.explanation.ecology && <p>{drawing.explanation.ecology}</p>}
      {drawing.discovery && (
        <>
          <h3>自分の発見</h3>
          <p>{drawing.discovery}</p>
        </>
      )}
      <h3>つぎに調べたいこと</h3>
      <p>{drawing.question}</p>
    </div>
  );
}
