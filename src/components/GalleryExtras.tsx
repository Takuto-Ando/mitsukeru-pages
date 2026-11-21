import { groups } from "../content/groups";
import {
  badgeStatus,
  bingoStatus,
  challengeProgress,
  nextAnimals,
} from "../future/extras";
import { currentSeason } from "../future/seasons";
import { COURSES, courseProgress } from "../future/courses";
import { loadPlan, savePlan } from "../future/plan";
import { ZooMap } from "./ZooMap";
import { PitsuneRoom } from "./PitsuneRoom";
import { useState } from "react";
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
  const [plan, setPlan] = useState<string[]>(loadPlan);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysGroups = new Set(
    drawings
      .filter((d) => d.createdAt.slice(0, 10) === todayKey)
      .map((d) => d.groupId),
  );
  const togglePlan = (id: string) => {
    const next = plan.includes(id)
      ? plan.filter((p) => p !== id)
      : plan.length >= 5
        ? plan
        : [...plan, id];
    setPlan(next);
    savePlan(next);
  };
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

      <section aria-label="今日のおでかけプラン">
        <h3 className="extras-heading">
          今日のおでかけプラン（{plan.filter((id) => todaysGroups.has(id)).length}
          / {plan.length} 達成）
        </h3>
        <p className="challenge-targets">
          今日見たい動物を5つまで選んでね。観察すると自動でチェックが付くよ。
        </p>
        <div className="quiz-category" role="group" aria-label="今日見たい動物">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={plan.includes(g.id)}
              className={plan.includes(g.id) ? "is-active" : ""}
              onClick={() => togglePlan(g.id)}
            >
              {todaysGroups.has(g.id) && plan.includes(g.id) ? "✓ " : ""}
              {g.name}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="観察コース">
        <h3 className="extras-heading">観察コース</h3>
        {COURSES.map((course) => {
          const progress = courseProgress(course, drawings);
          return (
            <div key={course.id} className="course-row">
              <p>
                <strong>{course.title}</strong>：{course.description}
              </p>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={course.groupIds.length}
                aria-valuenow={progress.doneIds.length}
                aria-label={course.title}
              >
                <div
                  className="progress-fill"
                  style={{
                    width: `${(progress.doneIds.length / course.groupIds.length) * 100}%`,
                  }}
                />
              </div>
              <p className="challenge-targets">
                {progress.complete
                  ? "コース制覇！おめでとう！"
                  : `つぎは ${groups.find((g) => g.id === progress.nextId)?.name} を観察しよう（ホームから選んでね）`}
              </p>
            </div>
          );
        })}
      </section>

      <ZooMap drawings={drawings} />
      <PitsuneRoom drawings={drawings} />

      <section aria-label="おうち動物園">
        <h3 className="extras-heading">おうち動物園（ライブカメラ）</h3>
        <p className="challenge-targets">
          動物園に行けない日は、世界の動物園のライブ映像で予習しよう。
        </p>
        <ul className="livecam-list">
          <li>
            <a
              href="https://nationalzoo.si.edu/webcams"
              target="_blank"
              rel="noreferrer"
            >
              スミソニアン国立動物園 Animal Cams（パンダ・ゾウ・ライオン）
            </a>
          </li>
          <li>
            <a
              href="https://zoo.sandiegozoo.org/live-cams"
              target="_blank"
              rel="noreferrer"
            >
              サンディエゴ動物園 Live Cameras（キリン・カバ・ゴリラほか）
            </a>
          </li>
        </ul>
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
