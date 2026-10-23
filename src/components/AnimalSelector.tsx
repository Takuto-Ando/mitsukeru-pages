import { groups, rosterNote } from "../content/groups";
export function AnimalSelector({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  return (
    <section className="animal-selector">
      <h2>観察する動物を選ぶ</h2>
      <p className="quiet-note">{rosterNote}</p>
      <div className="animal-grid">
        {groups.map((g) => (
          <button
            key={g.id}
            className="animal-choice"
            onClick={() => onSelect(g.id)}
          >
            <span>
              <strong>{g.name}</strong>
              <small>
                {g.part} ／{" "}
                {g.evaluation === "horizontal"
                  ? "ヤギの判定対応"
                  : "自己確認・提案お手本"}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
