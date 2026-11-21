import { X } from "lucide-react";
import { todaysMissions } from "../future/extras";
import type { ObservationRecord } from "../notebook/types";
import "../styles/extras.css";

// 園に持って行ける紙のミッションカード（印刷用レイアウト）。
export function MissionCard({
  drawings,
  onClose,
}: {
  drawings: ObservationRecord[];
  onClose: () => void;
}) {
  const missions = todaysMissions(drawings);
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return (
    <section className="mission-panel" aria-label="今日のミッションカード">
      <div className="quiz-head">
        <h2>今日のミッションカード</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="ミッションカードを閉じる"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="mission-sheet">
        <p className="mission-date">{today}・京都市動物園</p>
        <p>今日のミッションは この3つ。見つけたら □ にチェック！</p>
        <ul className="mission-list">
          {missions.map((g) => (
            <li key={g.id}>
              <span className="mission-box" aria-hidden="true" />
              <span>
                <strong>{g.name}</strong> の {g.part} を観察しよう
                <span className="mission-question">{g.question}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mission-note">
          観察したら ズーケッチで スケッチしてね。
        </p>
      </div>
      <button
        type="button"
        className="report-print"
        onClick={() => window.print()}
      >
        ミッションカードを印刷する
      </button>
    </section>
  );
}
