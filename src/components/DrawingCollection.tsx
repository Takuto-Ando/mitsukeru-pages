import { NotebookTools } from "./NotebookTools";
import { useEffect, useId, useState } from "react";
import { groups } from "../content/groups";
import { drawingScene } from "../collection/drawingScene";
import { taskById } from "../content/tasks";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import { SketchComparison } from "./SketchComparison";
import {
  composeObservationImages,
  composeCardPng,
  savePng,
} from "../notebook/images";
import { updateObservationImages } from "../notebook/storage";
import type { ObservationRecord } from "../notebook/types";
import { recordStudy } from "../research/study";

function Thumbnail({ drawing }: { drawing: ObservationRecord }) {
  const clip = useId();
  const [source, setSource] = useState<{ id: string; url: string }>();
  useEffect(() => {
    if (!drawing.ownPng) {
      setSource(undefined);
      return;
    }
    const url = URL.createObjectURL(drawing.ownPng);
    setSource({ id: drawing.id, url });
    return () => URL.revokeObjectURL(url);
  }, [drawing.id, drawing.ownPng]);
  const scene = drawing.sceneSnapshot || drawingScene(drawing);
  return (
    <svg
      viewBox={`0 0 600 ${scene.frameHeight || 400}`}
      role="img"
      aria-label={scene.label + "に描き足した絵"}
    >
      <defs>
        <clipPath id={clip}>
          <SceneRegions scene={scene} />
        </clipPath>
      </defs>
      {source?.id === drawing.id ? (
        <image
          href={source.url}
          width="600"
          height={scene.frameHeight || 400}
        />
      ) : (
        <>
          <SceneBase scene={scene} completed />
          <g clipPath={`url(#${clip})`}>
            <SketchLines strokes={drawing.strokes} />
          </g>
        </>
      )}
    </svg>
  );
}

export function DrawingCollection({
  drawings,
  onDelete,
  onBack,
  onUpdate,
}: {
  drawings: ObservationRecord[];
  onDelete: (id: string) => Promise<boolean> | boolean;
  onBack: () => void;
  onUpdate?: () => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<string>();
  const [visibleCount, setVisibleCount] = useState(12);
  const [deleting, setDeleting] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [urls, setUrls] = useState<{
    id: string;
    own: string;
    answer: string;
  }>();
  const drawing = drawings.find((d) => d.id === selected);
  const group = drawing && groups.find((g) => g.id === drawing.groupId);

  useEffect(() => {
    if (!drawing?.ownPng || !drawing?.answerPng) {
      setUrls(undefined);
      return;
    }
    const own = URL.createObjectURL(drawing.ownPng);
    const answer = URL.createObjectURL(drawing.answerPng);
    setUrls({ id: drawing.id, own, answer });
    return () => {
      URL.revokeObjectURL(own);
      URL.revokeObjectURL(answer);
    };
  }, [drawing?.id, drawing?.ownPng, drawing?.answerPng]);

  async function exportPng(kind: "own" | "comparison") {
    if (!drawing || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const scene = drawing.sceneSnapshot || drawingScene(drawing);
      let ownPng = drawing.ownPng;
      let comparisonPng = drawing.comparisonPng;
      if (!ownPng || !comparisonPng) {
        const composed = await composeObservationImages(scene, drawing.strokes);
        ownPng = composed.ownPng;
        comparisonPng = composed.comparisonPng;
        await updateObservationImages(drawing.id, composed);
        await onUpdate?.();
      }
      const date = drawing.createdAt.slice(0, 10);
      const blob = kind === "own" ? ownPng : comparisonPng;
      const suffix = kind === "own" ? "sketch" : "comparison";
      await savePng(
        await composeCardPng(blob, drawing, kind === "comparison"),
        `zooketch-${drawing.taskId}-${date}-${suffix}.png`,
      );
    } catch {
      setExportError("PNG画像を書き出せませんでした。もう一度試してください。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="drawing-collection" aria-label="観察ノート">
      <button className="text-button" onClick={onBack}>
        体験に戻る
      </button>
      <h1>観察ノート</h1>
      <p>{drawings.length}枚の観察カードを保存しています。</p>
      <NotebookTools drawings={drawings} onRestored={onUpdate} />
      <p className="quiet-note">
        このブラウザ・アプリの中だけに保存します。SafariとiPhoneアプリの保存は別々です。撮影写真や位置情報は保存しません。
      </p>
      {!drawings.length && (
        <p>観察を終えたら「観察を保存する」で、ここにカードを残せるよ。</p>
      )}
      {drawing && group ? (
        <div className="notebook-detail">
          <button
            className="text-button"
            onClick={() => {
              setSelected(undefined);
              setExportError("");
            }}
          >
            一覧に戻る
          </button>
          <h2>{drawing.animalName}</h2>
          <p className="center">
            <strong>{drawing.taskName}</strong>
          </p>
          <p className="quiet-note center">
            観察日:{" "}
            <time dateTime={drawing.createdAt}>
              {new Date(drawing.createdAt).toLocaleDateString("ja-JP")}
            </time>
          </p>
          <SketchComparison
            strokes={drawing.strokes}
            scene={drawing.sceneSnapshot || drawingScene(drawing)}
            images={urls?.id === drawing.id ? urls : undefined}
            profile={taskById[drawing.taskId || group.id]?.profile}
            answer={group.answer}
            onSliderCommit={(from, to, via) =>
              recordStudy(
                "comparison_slider_moved",
                { from, to, via, reason: "notebook" },
                {
                  animalId: drawing.groupId,
                  taskId: drawing.taskId,
                  attemptId: undefined,
                },
              )
            }
          />
          <div className="png-actions">
            <button
              className="primary collection-save"
              disabled={exporting}
              onClick={() => void exportPng("own")}
            >
              自分の絵をPNGで保存
            </button>
            <button
              className="primary collection-save"
              disabled={exporting}
              onClick={() => void exportPng("comparison")}
            >
              比較画像をPNGで保存
            </button>
          </div>
          {exportError && <p role="alert">{exportError}</p>}
          <div className="figma-explanation">
            <h2>{drawing.explanation.name}</h2>
            <h3>よく見ると…</h3>
            <p>{drawing.explanation.form}</p>
            {drawing.explanation.ecology && (
              <>
                <h3>くらしとのつながり</h3>
                <p>{drawing.explanation.ecology}</p>
              </>
            )}
          </div>
          {drawing.question && <p className="figma-note">{drawing.question}</p>}
        </div>
      ) : (
        <div className="collection-grid">
          {drawings.slice(0, visibleCount).map((d) => (
            <article className="collection-card" key={d.id}>
              <button
                className="collection-open"
                onClick={() => {
                  setSelected(d.id);
                  setDeleting(undefined);
                  setExportError("");
                  recordStudy(
                    "comparison_opened",
                    { reason: "notebook" },
                    {
                      animalId: d.groupId,
                      taskId: d.taskId,
                      attemptId: undefined,
                    },
                  );
                }}
                aria-label={d.animalName + "の絵を見返す"}
              >
                <Thumbnail drawing={d} />
                <strong>{d.animalName}</strong>
                <span className="collection-part">{d.taskName}</span>
                <time dateTime={d.createdAt}>
                  {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                </time>
              </button>
              {deleting === d.id ? (
                <div>
                  <p>この絵を削除する？</p>
                  <button
                    className="text-button"
                    onClick={async () => {
                      if (await onDelete(d.id)) setDeleting(undefined);
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
      {!drawing && drawings.length > visibleCount && (
        <button
          className="text-button"
          onClick={() => setVisibleCount((count) => count + 12)}
        >
          もっと見る（残り{drawings.length - visibleCount}枚）
        </button>
      )}
    </section>
  );
}
