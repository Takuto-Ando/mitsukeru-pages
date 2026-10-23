import { groups } from "../content/groups";
export function AnimalSelector({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  return (
    <section className="animal-selector">
      <h2>観察する動物を選ぶ</h2>
      <div className="animal-grid">
        {groups.map((g) => (
          <button
            key={g.id}
            className="animal-choice"
            onClick={() => onSelect(g.id)}
          >
            <span>
              <strong>{g.name}</strong>
              <small>{g.part}をよく見てみよう</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
