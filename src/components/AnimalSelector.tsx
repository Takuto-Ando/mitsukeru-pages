import { tasksForGroup } from "../content/tasks";
import { artwork, assetPath } from "../content/artwork";
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
            <img
              src={assetPath(artwork[tasksForGroup(g.id)[0].id].reference!)}
              alt=""
              loading="lazy"
              decoding="async"
              width="64"
              height="64"
            />
            <span>
              <strong>{g.name}</strong>
              <small>{tasksForGroup(g.id).length}つの観察ポイント</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
