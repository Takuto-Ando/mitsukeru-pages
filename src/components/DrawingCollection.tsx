import { NotebookTools } from "./NotebookTools";
import { QuizPanel } from "./QuizPanel";
import { ParentReport } from "./ParentReport";
import { FeatureCelebration } from "./FeatureCelebration";
import { TongueCelebration } from "./TongueCelebration";
import { GalleryExtras } from "./GalleryExtras";
import { MissionCard } from "./MissionCard";
import { MiniBook } from "./MiniBook";
import { PosterPrint } from "./PosterPrint";
import { VoiceNote } from "./VoiceNote";
import { downloadTimelapse } from "../future/timelapse";
import { knowledgeFor } from "../future/knowledge";
import { Furi } from "../furigana/Furigana";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { groups } from "../content/groups";
import { assetPath } from "../content/artwork";
import { drawingScene } from "../collection/drawingScene";
import { taskById, tasksForGroup } from "../content/tasks";
import { applyStyles } from "../drawing/styles";
import { designCardViewport } from "../drawing/viewport";
import { SceneBase, SceneRegions } from "./ObservationScene";
import { SketchLines } from "../Illustrations";
import { SketchComparison } from "./SketchComparison";
import { DifficultyPill } from "./DifficultyPill";
import { Pitsune } from "./Pitsune";
import { ReadAloud } from "../speech/Speech";
import {
  composeObservationImages,
  composeCardPng,
  savePng,
} from "../notebook/images";
import { updateObservationImages } from "../notebook/storage";
import type { ObservationRecord } from "../notebook/types";
import { recordStudy } from "../research/study";
import { loadProfiles, recordProfileId } from "../future/profiles";
import "../styles/design3-gallery.css";

function GalleryMark({
  mark,
}: {
  mark:
    | "title"
    | "sketch"
    | "sketch-label"
    | "photo"
    | "photo-label"
    | "camera"
    | "camera-empty"
    | "camera-label"
    | "close";
}) {
  const mask = `url("${assetPath(`figma/entry/gallery-${mark}.svg`)}")`;
  return (
    <span
      aria-hidden="true"
      className={`gallery-mark gallery-mark--${mark}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}

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
  const height = scene.frameHeight || 400;
  const viewport = designCardViewport(scene);
  return (
    <svg
      viewBox={
        viewport
          ? `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`
          : `0 0 600 ${height}`
      }
      preserveAspectRatio={viewport ? "none" : undefined}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <SceneRegions scene={scene} />
        </clipPath>
      </defs>
      {source?.id === drawing.id ? (
        <image href={source.url} width="600" height={height} />
      ) : (
        <>
          <SceneBase scene={scene} completed />
          <g clipPath={`url(#${clip})`}>
            {drawing.styles?.map((style, index) =>
              style?.fill ? (
                <image
                  key={index}
                  href={style.fill}
                  width="600"
                  height={height}
                />
              ) : null,
            )}
            <SketchLines strokes={drawing.strokes} />
          </g>
        </>
      )}
    </svg>
  );
}

export function DrawingCollection({
  drawings: allDrawings,
  onDelete,
  onBack,
  onCamera,
  onUpdate,
}: {
  drawings: ObservationRecord[];
  onDelete: (id: string) => Promise<boolean> | boolean;
  onBack: () => void;
  onCamera: () => void;
  onUpdate?: () => Promise<void> | void;
}) {
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const profiles = loadProfiles();
  const drawings =
    profileFilter === "all"
      ? allDrawings
      : allDrawings.filter(
          (d) => recordProfileId(d) === profileFilter,
        );
  const galleryId = useId();
  const detailId = useId();
  const detail = useRef<HTMLDialogElement>(null);
  const sketchTab = useRef<HTMLButtonElement>(null);
  const photoTab = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<"sketch" | "photo">("sketch");
  const [selected, setSelected] = useState<string>();
  const [sortMode, setSortMode] = useState<"new" | "animal">("new");
  const [panel, setPanel] = useState<
    "quiz" | "report" | "mission" | "book" | null
  >(null);
  const [nightMode, setNightMode] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const sortedDrawings = [...drawings].sort((a, b) =>
    sortMode === "new"
      ? b.createdAt.localeCompare(a.createdAt)
      : a.animalName.localeCompare(b.animalName, "ja") ||
        b.createdAt.localeCompare(a.createdAt),
  );
  const [visibleCount, setVisibleCount] = useState(12);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detailError, setDetailError] = useState<{
    id: string;
    message: string;
  }>();
  const [urls, setUrls] = useState<{
    id: string;
    own: string;
    answer: string;
  }>();
  const drawing = drawings.find((d) => d.id === selected);
  const speciesCount = new Set(drawings.map((d) => d.groupId)).size;
  const observationDays = new Set(drawings.map((d) => d.createdAt.slice(0, 10)))
    .size;
  const streak = (() => {
    const days = new Set(drawings.map((d) => d.createdAt.slice(0, 10)));
    const cursor = new Date();
    const key = (d: Date) => d.toISOString().slice(0, 10);
    if (!days.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    let count = 0;
    while (days.has(key(cursor))) {
      count++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return count;
  })();
  useEffect(() => {
    for (const d of drawings) applyStyles(d.strokes, d.styles);
  }, [drawings]);
  const completeGroups = groups.filter((g) => {
    const groupTasks = tasksForGroup(g.id);
    return groupTasks.every((t) =>
      drawings.some(
        (d) =>
          d.taskId === t.id || (groupTasks.length === 1 && d.groupId === g.id),
      ),
    );
  });
  const group = drawing && groups.find((g) => g.id === drawing.groupId);
  const scene = drawing && (drawing.sceneSnapshot || drawingScene(drawing));
  const viewport = scene && designCardViewport(scene);

  useEffect(() => {
    detail.current?.showModal();
  }, [selected]);

  function closeDetail() {
    detail.current?.close();
    setSelected(undefined);
    setConfirmDelete(false);
    setDetailError(undefined);
  }

  useEffect(() => {
    if (viewport || !drawing?.ownPng || !drawing?.answerPng) {
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
  }, [drawing?.id, drawing?.ownPng, drawing?.answerPng, viewport]);

  async function exportPng(kind: "own" | "comparison") {
    if (!drawing || exporting) return;
    setExporting(true);
    setDetailError(undefined);
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
      setDetailError({
        id: drawing.id,
        message: "PNG画像を書き出せませんでした。もう一度試してください。",
      });
    } finally {
      setExporting(false);
    }
  }

  async function shareOwn() {
    if (!drawing || exporting) return;
    setExporting(true);
    setDetailError(undefined);
    try {
      const scene = drawing.sceneSnapshot || drawingScene(drawing);
      let ownPng = drawing.ownPng;
      if (!ownPng) {
        const composed = await composeObservationImages(scene, drawing.strokes);
        ownPng = composed.ownPng;
        await updateObservationImages(drawing.id, composed);
        await onUpdate?.();
      }
      const date = drawing.createdAt.slice(0, 10);
      const card = await composeCardPng(ownPng, drawing, false);
      const file = new File(
        [card],
        `zooketch-${drawing.taskId}-${date}-sketch.png`,
        {
          type: "image/png",
        },
      );
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file] });
      else await savePng(card, file.name);
    } catch (error) {
      if ((error as Error)?.name !== "AbortError")
        setDetailError({
          id: drawing.id,
          message: "シェアできませんでした。PNG保存をお試しください。",
        });
    } finally {
      setExporting(false);
    }
  }

  async function deleteDrawing() {
    if (!drawing || deleting || exporting) return;
    setDeleting(true);
    setDetailError(undefined);
    try {
      if (await onDelete(drawing.id)) {
        closeDetail();
        sketchTab.current?.focus();
        return;
      }
      setDetailError({
        id: drawing.id,
        message: "観察を削除できませんでした。もう一度試してください。",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      className="drawing-collection gallery-screen"
      aria-labelledby={galleryId}
    >
      <header className="gallery-header">
        <button type="button" onClick={onBack} aria-label="体験に戻る">
          <ChevronLeft size={28} aria-hidden="true" />
        </button>
        <h1 id={galleryId}>
          <span className="sr-only">マイギャラリー</span>
          <GalleryMark mark="title" />
        </h1>
      </header>
      <div className="gallery-sheet">
        <div
          className="gallery-tabs"
          role="tablist"
          aria-label="ギャラリーの表示"
          onKeyDown={(event) => {
            const other = tab === "sketch" ? "photo" : "sketch";
            const destinations = {
              Home: "sketch",
              End: "photo",
              ArrowLeft: other,
              ArrowRight: other,
            } as const;
            if (!(event.key in destinations)) return;
            event.preventDefault();
            const next = destinations[event.key as keyof typeof destinations];
            setTab(next);
            (next === "sketch" ? sketchTab : photoTab).current?.focus();
          }}
        >
          <button
            type="button"
            ref={sketchTab}
            id={galleryId + "-sketch"}
            role="tab"
            aria-controls={galleryId + "-sketch-panel"}
            aria-selected={tab === "sketch"}
            tabIndex={tab === "sketch" ? 0 : -1}
            onClick={() => setTab("sketch")}
          >
            <GalleryMark mark="sketch" />
            <GalleryMark mark="sketch-label" />
            <span className="sr-only">スケッチ</span>
          </button>
          <button
            type="button"
            ref={photoTab}
            id={galleryId + "-photo"}
            role="tab"
            aria-controls={galleryId + "-photo-panel"}
            aria-selected={tab === "photo"}
            tabIndex={tab === "photo" ? 0 : -1}
            onClick={() => setTab("photo")}
          >
            <GalleryMark mark="photo" />
            <GalleryMark mark="photo-label" />
            <span className="sr-only">写真</span>
          </button>
        </div>
        <div
          id={galleryId + "-sketch-panel"}
          role="tabpanel"
          aria-labelledby={galleryId + "-sketch"}
          hidden={tab !== "sketch"}
          tabIndex={0}
        >
          <div className="collection-grid">
            {sortedDrawings.slice(0, visibleCount).map((d) => (
              <article className="collection-card" key={d.id}>
                <button
                  className="collection-open"
                  onClick={() => {
                    setSelected(d.id);
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
                  <span className="gallery-card-meta">
                    <strong>{d.animalName}</strong>
                    <span className="collection-part">{d.taskName}</span>
                    <time dateTime={d.createdAt}>
                      {new Date(d.createdAt).toLocaleDateString("ja-JP")}
                    </time>
                  </span>
                </button>
              </article>
            ))}
            {Array.from(
              { length: Math.max(0, 6 - drawings.length) },
              (_, index) => (
                <div className="gallery-slot" aria-hidden="true" key={index} />
              ),
            )}
          </div>
          {!drawings.length && (
            <p className="gallery-sketch-empty">
              スケッチを描いて「つぎへ」を押すと、ここで見返せるよ。
            </p>
          )}
          {drawings.length > visibleCount && (
            <button
              className="text-button gallery-more"
              onClick={() => setVisibleCount((count) => count + 12)}
            >
              もっと見る（残り{drawings.length - visibleCount}枚）
            </button>
          )}
          <div className="collection-progress" aria-live="polite">
            <p>{drawings.length}枚の観察カードを保存しています。</p>
            <p>
              <strong>
                {speciesCount} / {groups.length}
              </strong>{" "}
              種・観察した日 {observationDays}日・れんぞく {streak}日
            </p>
            {speciesCount === groups.length && (
              <p className="master-badge">
                ずかんマスター！ ぜんぶの動物を観察したよ
              </p>
            )}
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={groups.length}
              aria-valuenow={speciesCount}
              aria-label="集めた動物の種類"
            >
              <div
                className="progress-fill"
                style={{ width: `${(speciesCount / groups.length) * 100}%` }}
              />
            </div>
            {completeGroups.length > 0 && (
              <ul className="complete-badges">
                {completeGroups.map((g) => (
                  <li key={g.id}>{g.name} コンプリート！</li>
                ))}
              </ul>
            )}
          </div>
          {profiles.length > 1 && (
            <div
              className="profile-filter"
              role="group"
              aria-label="プロフィールで絞り込み"
            >
              <button
                type="button"
                aria-pressed={profileFilter === "all"}
                className={profileFilter === "all" ? "is-active" : ""}
                onClick={() => setProfileFilter("all")}
              >
                ぜんぶ
              </button>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={profileFilter === p.id}
                  className={profileFilter === p.id ? "is-active" : ""}
                  onClick={() => setProfileFilter(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="gallery-actions">
            <button
              type="button"
              aria-pressed={panel === "quiz"}
              onClick={() => setPanel(panel === "quiz" ? null : "quiz")}
            >
              クイズであそぶ
            </button>
            <button
              type="button"
              aria-pressed={panel === "report"}
              onClick={() => setPanel(panel === "report" ? null : "report")}
            >
              おうちの人レポート
            </button>
            <button
              type="button"
              aria-pressed={panel === "mission"}
              onClick={() => setPanel(panel === "mission" ? null : "mission")}
            >
              ミッションカード
            </button>
            <button
              type="button"
              aria-pressed={panel === "book"}
              onClick={() => setPanel(panel === "book" ? null : "book")}
            >
              ミニ絵本
            </button>
          </div>
          <GalleryExtras drawings={drawings} />
          {panel === "quiz" && <QuizPanel onClose={() => setPanel(null)} />}
          {panel === "report" && (
            <ParentReport drawings={drawings} onClose={() => setPanel(null)} />
          )}
          {panel === "mission" && (
            <MissionCard drawings={drawings} onClose={() => setPanel(null)} />
          )}
          {panel === "book" && (
            <MiniBook drawings={drawings} onClose={() => setPanel(null)} />
          )}
          {drawings.length > 1 && (
            <div className="collection-sort" role="group" aria-label="並び替え">
              <button
                aria-pressed={sortMode === "new"}
                onClick={() => setSortMode("new")}
              >
                新しい順
              </button>
              <button
                aria-pressed={sortMode === "animal"}
                onClick={() => setSortMode("animal")}
              >
                動物の名前順
              </button>
            </div>
          )}
          <NotebookTools drawings={allDrawings} onRestored={onUpdate} />
          <p className="quiet-note">
            スケッチはこのブラウザ・アプリの中に保存します。SafariとiPhoneアプリの保存は別々です。
          </p>
        </div>
        <div
          id={galleryId + "-photo-panel"}
          role="tabpanel"
          aria-labelledby={galleryId + "-photo"}
          hidden={tab !== "photo"}
          tabIndex={0}
        >
          <div className="collection-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                className={
                  index === 0
                    ? "gallery-slot gallery-slot--camera"
                    : "gallery-slot"
                }
                key={index}
              >
                {index === 0 && <GalleryMark mark="camera-empty" />}
              </div>
            ))}
          </div>
          <div className="gallery-photo-empty">
            <Pitsune pose="face" className="gallery-empty-pitsune" />
            <h2>写真は保存されないよ</h2>
            <p>
              撮影した写真は動物の観察に使います。撮影写真や位置情報は保存しません。
            </p>
          </div>
        </div>
      </div>
      <button type="button" className="gallery-camera" onClick={onCamera}>
        <GalleryMark mark="camera" />
        <GalleryMark mark="camera-label" />
        <span className="sr-only">写真を撮る</span>
      </button>
      {drawing && group && scene && (
        <dialog
          ref={detail}
          className="gallery-detail"
          aria-labelledby={detailId}
          onCancel={(event) => {
            event.preventDefault();
            if (!deleting) closeDetail();
          }}
          onClick={(event) => {
            if (!deleting && event.target === event.currentTarget)
              closeDetail();
          }}
        >
          <div className="gallery-detail-actions">
            <button
              type="button"
              onClick={closeDetail}
              aria-label="一覧に戻る"
              disabled={deleting}
            >
              <GalleryMark mark="close" />
            </button>
            <DifficultyPill regionCount={scene.regions.length} />
          </div>
          <div className="gallery-detail-scroll" tabIndex={-1} autoFocus>
            <SketchComparison
              strokes={drawing.strokes}
              scene={scene}
              images={!viewport && urls?.id === drawing.id ? urls : undefined}
              profile={taskById[drawing.taskId || group.id]?.profile}
              answer={group.answer}
              initialMode="drawing"
              viewport={viewport}
              cardFooter={
                <div className="gallery-detail-fact">
                  <p>
                    <Furi text={drawing.explanation.form} />
                  </p>
                  {drawing.explanation.ecology && (
                    <p>
                      <Furi text={drawing.explanation.ecology} />
                    </p>
                  )}
                </div>
              }
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
            {(() => {
              const detailTask = taskById[drawing.taskId || group.id];
              if (!detailTask) return null;
              return detailTask.id === "giraffe" ? (
                <TongueCelebration strokes={drawing.strokes} scene={scene} />
              ) : (
                <FeatureCelebration
                  strokes={drawing.strokes}
                  scene={scene}
                  taskId={detailTask.id}
                />
              );
            })()}
            <div className="gallery-detail-tools">
              <h2 id={detailId}>
                {drawing.animalName} <span>{drawing.taskName}</span>
              </h2>
              <button
                type="button"
                onClick={() =>
                  downloadTimelapse(
                    drawing.strokes,
                    scene.frameHeight || 400,
                    `${drawing.animalName} ${drawing.taskName}`,
                    `zooketch-timelapse-${drawing.id}.svg`,
                  )
                }
              >
                タイムラプス（アニメSVG）を保存
              </button>
              <VoiceNote drawing={drawing} onSaved={onUpdate} />
              {(() => {
                const knowledge = knowledgeFor(drawing.groupId);
                if (!knowledge) return null;
                return (
                  <>
                    <p className="keeper-memo">
                      飼育員さんメモ：{knowledge.keeper}
                    </p>
                    <button
                      type="button"
                      aria-pressed={nightMode}
                      onClick={() => setNightMode((v) => !v)}
                    >
                      {nightMode ? "昼の姿にもどす" : "夜の姿を見る"}
                    </button>
                    {nightMode && (
                      <p className="night-note">
                        夜の {drawing.animalName}：{knowledge.night}
                      </p>
                    )}
                  </>
                );
              })()}
              <button
                type="button"
                aria-pressed={posterOpen}
                onClick={() => setPosterOpen((v) => !v)}
              >
                自由研究ポスター
              </button>
              {posterOpen && (
                <>
                  <PosterPrint
                    drawing={drawing}
                    ownUrl={urls?.id === drawing.id ? urls.own : undefined}
                  />
                  <button
                    type="button"
                    className="report-print"
                    onClick={() => window.print()}
                  >
                    ポスターを印刷する
                  </button>
                </>
              )}
              <p className="quiet-note">
                観察日{" "}
                <time dateTime={drawing.createdAt}>
                  {new Date(drawing.createdAt).toLocaleDateString("ja-JP")}
                </time>
              </p>
              <ReadAloud
                id={"gallery-" + drawing.id}
                text={`${drawing.explanation.name}。${drawing.explanation.form}${drawing.explanation.ecology}`}
              />
              <div className="png-actions">
                <button
                  className="primary collection-save"
                  disabled={exporting || deleting}
                  onClick={() => void exportPng("own")}
                >
                  自分の絵をPNGで保存
                </button>
                <button
                  className="primary collection-save"
                  disabled={exporting || deleting}
                  onClick={() => void exportPng("comparison")}
                >
                  比較画像をPNGで保存
                </button>
                {"share" in navigator && (
                  <button
                    className="primary collection-save"
                    disabled={exporting || deleting}
                    onClick={() => void shareOwn()}
                  >
                    シェアする
                  </button>
                )}
              </div>
              {detailError?.id === drawing.id && (
                <p role="alert">{detailError.message}</p>
              )}
              {drawing.discovery && (
                <div className="gallery-discovery">
                  <h3>わたしの気づき</h3>
                  <p className="discovery-text">{drawing.discovery}</p>
                </div>
              )}
              {drawing.revisited && (
                <p className="quiet-note">
                  実物をもう一度見て確かめた（自分の記録）
                </p>
              )}
              {drawing.question && (
                <p className="figma-note">{drawing.question}</p>
              )}
              {confirmDelete ? (
                <div>
                  <p>この絵を削除する？</p>
                  <button
                    className="text-button"
                    disabled={deleting || exporting}
                    onClick={() => void deleteDrawing()}
                  >
                    削除する
                  </button>
                  <button
                    className="text-button"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    残す
                  </button>
                </div>
              ) : (
                <button
                  className="text-button"
                  disabled={exporting}
                  onClick={() => setConfirmDelete(true)}
                >
                  削除
                </button>
              )}
            </div>
          </div>
        </dialog>
      )}
    </section>
  );
}
