import { X } from "lucide-react";
import { groups } from "../content/groups";
import { tasksForGroup } from "../content/tasks";
import { monthStats, observationsToCsv } from "../future/extras";
import type { ObservationRecord } from "../notebook/types";
import "../styles/future4.css";

// おうちの人向けの観察レポート。保存済みの観察記録だけから集計する。
export function ParentReport({
  drawings,
  onClose,
}: {
  drawings: ObservationRecord[];
  onClose: () => void;
}) {
  const total = drawings.length;
  const days = new Set(drawings.map((d) => d.createdAt.slice(0, 10)));
  const species = new Set(drawings.map((d) => d.groupId));
  const sortedDates = [...days].sort();
  const firstDay = sortedDates[0];
  const lastDay = sortedDates[sortedDates.length - 1];

  const perGroup = groups
    .map((g) => {
      const groupTasks = tasksForGroup(g.id);
      const doneTaskIds = new Set(
        drawings.filter((d) => d.groupId === g.id).map((d) => d.taskId),
      );
      return {
        name: g.name,
        done: groupTasks.filter((t) => doneTaskIds.has(t.id)).length,
        all: groupTasks.length,
        cards: drawings.filter((d) => d.groupId === g.id).length,
      };
    })
    .filter((row) => row.cards > 0)
    .sort((a, b) => b.cards - a.cards);
  const mostObserved = perGroup[0];

  const formatDay = (iso?: string) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—";

  return (
    <section className="report-panel" aria-label="おうちの人向け観察レポート">
      <div className="quiz-head">
        <h2>おうちの人へ：観察レポート</h2>
        <button type="button" onClick={onClose} aria-label="レポートを閉じる">
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      {total === 0 ? (
        <p>まだ観察カードがありません。最初の1枚を描くと、ここに記録がたまります。</p>
      ) : (
        <>
          <dl className="report-stats">
            <div>
              <dt>観察カード</dt>
              <dd>{total} 枚</dd>
            </div>
            <div>
              <dt>観察した動物</dt>
              <dd>
                {species.size} / {groups.length} 種
              </dd>
            </div>
            <div>
              <dt>観察した日</dt>
              <dd>{days.size} 日</dd>
            </div>
            <div>
              <dt>期間</dt>
              <dd>
                {formatDay(firstDay)} 〜 {formatDay(lastDay)}
              </dd>
            </div>
          </dl>
          {mostObserved && (
            <p>
              いちばん観察したのは <strong>{mostObserved.name}</strong>（
              {mostObserved.cards} 枚）です。
            </p>
          )}
          {(() => {
            const stats = monthStats(drawings);
            return (
              <p>
                今月は {stats.thisMonth.cards} 枚（{stats.thisMonth.species}{" "}
                種）、先月は {stats.lastMonth.cards} 枚（
                {stats.lastMonth.species} 種）の観察でした。
              </p>
            );
          })()}
          <h3>動物ごとの進みぐあい</h3>
          <ul className="report-groups">
            {perGroup.map((row) => (
              <li key={row.name}>
                <span className="report-group-name">{row.name}</span>
                <span
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={row.all}
                  aria-valuenow={row.done}
                  aria-label={`${row.name}の課題 ${row.done}/${row.all}`}
                >
                  <span
                    className="progress-fill"
                    style={{
                      width: `${row.all ? (row.done / row.all) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="report-group-count">
                  課題 {row.done} / {row.all} ・ カード {row.cards} 枚
                </span>
              </li>
            ))}
          </ul>
          <p className="quiet-note">
            このレポートは、この端末に保存された観察カードから自動で集計しています。
          </p>
          <button
            type="button"
            className="report-print"
            onClick={() => window.print()}
          >
            レポートを印刷する
          </button>
          <button
            type="button"
            className="report-print"
            onClick={() => {
              const blob = new Blob(["\uFEFF" + observationsToCsv(drawings)], {
                type: "text/csv;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "zooketch-observations.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            観察データをCSVで書き出す
          </button>
        </>
      )}
    </section>
  );
}
