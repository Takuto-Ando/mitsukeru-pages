import { groups } from "../content/groups";
import type { ObservationRecord } from "../notebook/types";

// 思い出マップ：観察した動物が園内マップ（模式図）にピン留めされていく。
const POSITIONS: Record<string, { x: number; y: number }> = Object.fromEntries(
  groups.map((g, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return [
      g.id,
      { x: 10 + col * 20 + (row % 2) * 4, y: 14 + row * 22 },
    ] as const;
  }),
);

export function ZooMap({ drawings }: { drawings: ObservationRecord[] }) {
  const observed = new Set(drawings.map((d) => d.groupId));
  return (
    <section aria-label="思い出マップ">
      <h3 className="extras-heading">
        思い出マップ（{observed.size} / {groups.length} 種）
      </h3>
      <div className="zoo-map">
        <div className="zoo-map-path" aria-hidden="true" />
        {groups.map((g) => {
          const pos = POSITIONS[g.id];
          const hit = observed.has(g.id);
          return (
            <span
              key={g.id}
              className={hit ? "zoo-pin is-hit" : "zoo-pin"}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              title={g.name}
            >
              {hit ? g.name.slice(0, 2) : "？"}
              <small>{g.name}</small>
            </span>
          );
        })}
      </div>
      <p className="challenge-targets">
        園内の配置を単純化した模式図です。観察するとピンが動物の名前になります。
      </p>
    </section>
  );
}
