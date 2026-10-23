import { useId, useState } from "react";
import type { DrawingRecord } from "../collection/storage";
import { groups } from "../content/groups";
import { scenes } from "../content/scenes";
import { profiles } from "../content/profiles";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import { SketchComparison } from "./SketchComparison";

function Thumbnail({ drawing }: { drawing: DrawingRecord }) {
  const clip = useId();
  const scene = scenes[drawing.groupId];
  return (
    <svg
      viewBox="0 0 600 400"
      role="img"
      aria-label={scene.label + "に描き足した絵"}
    >
      <defs>
        <clipPath id={clip}>
          <SceneRegions scene={scene} />
        </clipPath>
      </defs>
      <SceneBase scene={scene} completed />
      <g clipPath={`url(#${clip})`}>
        <SketchLines strokes={drawing.strokes} />
      </g>
    </svg>
  );
}
export function DrawingCollection({
  drawings,
  onDelete,
  onBack,
}: {
  drawings: DrawingRecord[];
  onDelete: (id: string) => boolean;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const drawing = drawings.find((d) => d.id === selected);
  const group = drawing && groups.find((g) => g.id === drawing.groupId)!;
  return (
    <section
      className="drawing-collection"
      aria-label="描いた動物のコレクション"
    >
      <button className="text-button" onClick={onBack}>
        体験に戻る
      </button>
      <h1>描いた動物</h1>
      <p>{drawings.length}枚の発見を保存しています。</p>
      <p className="quiet-note">
        このブラウザ・アプリの中だけに保存します。SafariとiPhoneアプリの保存は別々です。閲覧データの消去やアプリの削除で消えることがあります。
      </p>
      {!drawings.length && (
        <p>描き終えたら「この動物を保存する」で、ここに残せるよ。</p>
      )}
      {drawing && group ? (
        <div>
          <button
            className="text-button"
            onClick={() => setSelected(undefined)}
          >
            一覧に戻る
          </button>
          <h2>{group.name}</h2>
          <SketchComparison
            strokes={drawing.strokes}
            scene={scenes[group.id]}
            profile={profiles[group.id]}
            answer={group.answer}
          />
          <p>{group.fact}</p>
        </div>
      ) : (
        <div className="collection-grid">
          {drawings.map((d) => (
            <article className="collection-card" key={d.id}>
              <button
                className="collection-open"
                onClick={() => {
                  setSelected(d.id);
                  setDeleting(undefined);
                }}
                aria-label={
                  groups.find((g) => g.id === d.groupId)!.name + "の絵を見返す"
                }
              >
                <Thumbnail drawing={d} />
                <strong>{groups.find((g) => g.id === d.groupId)!.name}</strong>
                <time dateTime={d.createdAt}>
                  {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                </time>
              </button>
              {deleting === d.id ? (
                <div>
                  <p>この絵を削除する？</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (onDelete(d.id)) setDeleting(undefined);
                    }}
                  >
                    削除する
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDeleting(undefined)}
                  >
                    残す
                  </button>
                </div>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setDeleting(d.id)}
                >
                  削除
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
