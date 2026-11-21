import { groups } from "../content/groups";
import {
  badgeStatus,
  bingoStatus,
  challengeProgress,
  nextAnimals,
} from "../future/extras";
import { currentSeason } from "../future/seasons";
import type { ObservationRecord } from "../notebook/types";
import "../styles/extras.css";

// ギャラリーの進捗まわり：月替わりチャレンジ・特徴バッジ・次の動物。
export function GalleryExtras({
  drawings,
}: {
  drawings: ObservationRecord[];
}) {
  const { challenge, done, complete } = challengeProgress(drawings);
  const badges = badgeStatus(drawings);
  const next = nextAnimals(drawings);
  const bingo = bingoStatus(drawings);
  const season = currentSeason();
  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? id;

  return (
    <div className="gallery-extras">
      <section className="challenge-card" aria-label="今月の観察チャレンジ">
        <h3>
          今月のチャレンジ：{challenge.title}
          {complete && <span className="challenge-done">達成！</span>}
        </h3>
        <p>{challenge.description}</p>
        <p className="challenge-targets">
          対象：{challenge.targetGroupIds.map(groupName).join("・")}
        </p>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={challenge.goal}
          aria-valuenow={done}
          aria-label="チャレンジの進みぐあい"
        >
          <div
            className="progress-fill"
            style={{ width: `${(done / challenge.goal) * 100}%` }}
          />
        </div>
        <p className="challenge-count">
          今月 {done} / {challenge.goal} 種
        </p>
      </section>

      <section aria-label="特徴バッジ">
        <h3 className="extras-heading">特徴バッジ</h3>
        <ul className="feature-badges">
          {badges.map(({ badge, count, earned }) => (
            <li
              key={badge.id}
              className={earned ? "badge-chip is-earned" : "badge-chip"}
            >
              {badge.title}
              <span>
                {earned ? "ゲット！" : `${count} / ${badge.need}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="観察ビンゴ">
        <h3 className="extras-heading">
          観察ビンゴ
          {bingo.lines > 0 && (
            <span className="challenge-done">{bingo.lines} ライン ビンゴ！</span>
          )}
        </h3>
        <div className="bingo-grid">
          {bingo.cells.map(({ cell, hit }) => (
            <div
              key={cell.label}
              className={hit ? "bingo-cell is-hit" : "bingo-cell"}
            >
              {cell.label}
              <span>{hit ? "みつけた！" : "まだ"}</span>
            </div>
          ))}
        </div>
        <p className="challenge-targets">
          季節は {season.name}：ドパガキ版の描画では {season.name}
          の限定スタンプが使えるよ。
        </p>
      </section>

      {next.length > 0 && (
        <section aria-label="次に観察したい動物">
          <h3 className="extras-heading">つぎに観察したい動物</h3>
          <ul className="next-animals">
            {next.map((g) => (
              <li key={g.id}>{g.name}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
