import { useState } from "react";
import { tasks, taskById } from "../content/tasks";
import { artwork } from "../content/artwork";
import { SceneBase, SceneRegions } from "./ObservationScene";
export function AssetPreview() {
  const [id, setId] = useState("goat"),
    [complete, setComplete] = useState(false),
    [mask, setMask] = useState(true);
  const scene = taskById[id].scene;
  if (new URLSearchParams(location.search).get("assets") === "all")
    return (
      <main className="asset-review-grid">
        {tasks.map((t) => (
          <article key={t.id}>
            <h2>
              {t.id} / {t.part}
            </h2>
            <svg viewBox="0 0 600 400">
              <image
                href={import.meta.env.BASE_URL + artwork[t.id].explanation}
                width="600"
                height="400"
                preserveAspectRatio="none"
              />
              {[100, 200, 300, 400, 500].map((x) => (
                <g key={x}>
                  <path d={`M${x} 0V400`} stroke="#277e7888" />
                  <text x={x} y="15" fontSize="14">
                    {x}
                  </text>
                </g>
              ))}
              {[100, 200, 300].map((y) => (
                <g key={y}>
                  <path d={`M0 ${y}H600`} stroke="#277e7888" />
                  <text x="0" y={y} fontSize="14">
                    {y}
                  </text>
                </g>
              ))}
              <g fill="#277e7811" stroke="#277e78">
                <SceneRegions scene={t.scene} />
              </g>
            </svg>
          </article>
        ))}
      </main>
    );
  return (
    <main className="asset-preview">
      <h1>観察素材の配置確認</h1>
      <p>開発用プレビュー。全素材は600×400、マスクは0〜1の正規化座標です。</p>
      <label>
        動物
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {tasks.map((g) => (
            <option key={g.id} value={g.id}>
              {g.groupId} / {g.part}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={complete}
          onChange={(e) => setComplete(e.target.checked)}
        />
        完成側の背景
      </label>
      <label>
        <input
          type="checkbox"
          checked={mask}
          onChange={(e) => setMask(e.target.checked)}
        />
        マスク境界
      </label>
      <p>素材状態：{artwork[id].status}</p>
      <svg viewBox="0 0 600 400">
        <SceneBase scene={scene} completed={complete} />
        {mask && (
          <g fill="#4c9b9233" stroke="#4c9b92" strokeDasharray="5 4">
            <SceneRegions scene={scene} />
          </g>
        )}
      </svg>
      <pre>
        {JSON.stringify(
          { artwork: artwork[id], regions: scene.regions },
          null,
          2,
        )}
      </pre>
    </main>
  );
}
