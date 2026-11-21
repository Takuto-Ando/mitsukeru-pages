import { useState } from "react";
import { X } from "lucide-react";
import { artwork, assetPath } from "../content/artwork";
import { groups } from "../content/groups";
import { knowledgeFor } from "../future/knowledge";
import { ReadAloud } from "../speech/Speech";
import type { ObservationRecord } from "../notebook/types";

// 動物のミニ絵本：観察済みの動物について、絵と短い文で読める読み聞かせ絵本。
export function MiniBook({
  drawings,
  onClose,
}: {
  drawings: ObservationRecord[];
  onClose: () => void;
}) {
  const observedIds = [...new Set(drawings.map((d) => d.groupId))];
  const [groupId, setGroupId] = useState(observedIds[0] ?? "");
  const [page, setPage] = useState(0);
  const group = groups.find((g) => g.id === groupId);
  const record = drawings.find((d) => d.groupId === groupId);
  const knowledge = knowledgeFor(groupId);

  if (!group || !record) {
    return (
      <section className="quiz-panel" aria-label="ミニ絵本">
        <div className="quiz-head">
          <h2>動物のミニ絵本</h2>
          <button type="button" onClick={onClose} aria-label="閉じる">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <p>観察カードを保存すると、その動物の絵本が読めるようになるよ。</p>
      </section>
    );
  }

  const pages: { title: string; text: string }[] = [
    { title: group.name, text: `${group.name} のお話。${group.fact}` },
    {
      title: "かたちのひみつ",
      text: record.explanation.form,
    },
    {
      title: "くらしのひみつ",
      text:
        record.explanation.ecology ||
        `${group.name} は ${knowledge?.food ?? "いろいろなもの"} を食べます。`,
    },
    {
      title: "おしまい",
      text: `今日の発見：${group.question} つぎに会ったら、また観察してみよう。`,
    },
  ];
  const art = artwork[groupId];
  const pageData = pages[Math.min(page, pages.length - 1)];

  return (
    <section className="quiz-panel" aria-label="ミニ絵本">
      <div className="quiz-head">
        <h2>動物のミニ絵本</h2>
        <button type="button" onClick={onClose} aria-label="閉じる">
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="quiz-category" role="group" aria-label="絵本の動物">
        {observedIds.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={groupId === id}
            className={groupId === id ? "is-active" : ""}
            onClick={() => {
              setGroupId(id);
              setPage(0);
            }}
          >
            {groups.find((g) => g.id === id)?.name}
          </button>
        ))}
      </div>
      <div className="minibook-page">
        {page === 0 && art?.answer && (
          <img
            className="quiz-image"
            src={assetPath(art.answer)}
            alt={`${group.name}のイラスト`}
          />
        )}
        <h3>{pageData.title}</h3>
        <p>{pageData.text}</p>
        <ReadAloud text={pageData.text} id="minibook-readaloud" />
      </div>
      <div className="quiz-result-actions">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          まえのページ
        </button>
        <span>
          {page + 1} / {pages.length}
        </span>
        <button
          type="button"
          disabled={page >= pages.length - 1}
          onClick={() => setPage(page + 1)}
        >
          つぎのページ
        </button>
      </div>
    </section>
  );
}
