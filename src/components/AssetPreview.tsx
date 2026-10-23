import { useState } from "react";
import { groups } from "../content/groups";
import { scenes } from "../content/scenes";
import { artwork } from "../content/artwork";
import { SceneBase, SceneRegions } from "./ObservationScene";
export function AssetPreview() {
  const [id, setId] = useState("goat"),
    [complete, setComplete] = useState(false),
    [mask, setMask] = useState(true);
  const scene = scenes[id];
  return (
    <main className="asset-preview">
      <h1>観察素材の配置確認</h1>
      <p>開発用プレビュー。全素材は600×400、マスクは0〜1の正規化座標です。</p>
      <label>
        動物
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
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
