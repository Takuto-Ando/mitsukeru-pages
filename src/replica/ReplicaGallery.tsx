import { ZooCardSummary } from "../components/ZooCardSummary";
import {
  zooAnimalIdByName,
  zooAnimalSummary,
} from "../content/zooAnimalSummaries";
import type { Stroke, StrokeStyle } from "../types";
import { Furi } from "../furigana/Furigana";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, Share } from "lucide-react";
import { assetPath } from "../content/artwork";
import { taskById } from "../content/tasks";
import { groups } from "../content/groups";
import { penColorsFor } from "../content/sketchPresentation";
import { applyStyles } from "../drawing/styles";
import { designCardViewport } from "../drawing/viewport";
import { DifficultyPill } from "../components/DifficultyPill";
import { SketchComparison } from "../components/SketchComparison";
import { SketchResultCardFooter } from "../components/SketchResultCardFooter";
import { galleryPhotoLocation } from "./storage";
import { saveCapturedPhoto } from "./saveCapturedPhoto";
import "../styles/design3-gallery.css";
import "./replica-gallery.css";

export interface ReplicaRecord {
  id: string;
  createdAt: string;
  photo?: string;
  sketch?: string;
  strokes?: Stroke[];
  strokeStyles?: (StrokeStyle | null)[];
  groupId?: string;
  taskId?: string;
  animalName?: string;
  description?: string;
  photoDescription?: string;
  photoLocation?: string;
  samplePhoto?: boolean;
}

type GalleryTab = "sketch" | "photo";
const tabs = { sketch: "スケッチ", photo: "写真" } as const;

function Mark({ name }: { name: string }) {
  const maskImage = `url("${assetPath(`figma/entry/gallery-${name}.svg`)}")`;
  return (
    <span
      aria-hidden="true"
      className={`gallery-mark gallery-mark--${name}`}
      style={{ maskImage, WebkitMaskImage: maskImage }}
    />
  );
}

function Sketch({ entry }: { entry: ReplicaRecord }) {
  const scene = entry.taskId ? taskById[entry.taskId]?.scene : undefined;
  const viewport = scene && designCardViewport(scene);
  if (!viewport) {
    return (
      <img
        className="replica-sketch-image"
        src={entry.sketch}
        alt=""
        decoding="async"
      />
    );
  }
  // Keep the paper card crop inside the saved image at every screen width.
  const sceneWidth = 600;
  const sceneHeight = scene.frameHeight || 400;
  const width = Math.min(viewport.width, sceneWidth);
  const height = Math.min(viewport.height, sceneHeight);
  const x = Math.max(0, Math.min(viewport.x, sceneWidth - width));
  const y = Math.max(0, Math.min(viewport.y, sceneHeight - height));
  return (
    <svg
      className="replica-sketch-image"
      viewBox={`${x} ${y} ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <image href={entry.sketch} width={sceneWidth} height={sceneHeight} />
    </svg>
  );
}

function entrySummary(entry: ReplicaRecord, tab: GalleryTab) {
  const task = entry.taskId ? taskById[entry.taskId] : undefined;
  return zooAnimalSummary(
    entry.groupId ??
      task?.groupId ??
      zooAnimalIdByName(entry.animalName) ??
      (entry.samplePhoto ? "giraffe" : undefined),
    tab === "sketch" ? task?.id : undefined,
  );
}

function SketchReplay({
  entry,
  summary,
  legacy,
}: {
  entry: ReplicaRecord;
  summary?: string;
  legacy: boolean;
}) {
  const [play, setPlay] = useState(0);
  const task = entry.taskId ? taskById[entry.taskId] : undefined;
  const group = groups.find(({ id }) => id === task?.groupId);
  const strokes = useMemo(() => {
    if (!entry.strokes || !task) return;
    const copied = entry.strokes.map((stroke) => [...stroke]);
    const color = penColorsFor(task.groupId)[0];
    applyStyles(
      copied,
      entry.strokeStyles ?? copied.map(() => ({ color, width: 7 })),
    );
    return copied;
  }, [entry.strokes, entry.strokeStyles, task]);
  const footer = legacy ? (
    summary && (
      <div className="gallery-detail-fact">
        <ZooCardSummary text={summary} />
      </div>
    )
  ) : (
    <SketchResultCardFooter
      title={`${entry.animalName ?? group?.name ?? "動物"}の${task?.part ?? "スケッチ"}`}
      regionCount={task?.scene.regions.length ?? 1}
      summary={summary}
    />
  );
  if (!task || !group || !strokes?.length) {
    return (
      <article
        className={`sketch-comparison-card${legacy ? "" : " sketch-result-card"}`}
      >
        {legacy ? (
          <Sketch entry={entry} />
        ) : (
          <div className="comparison-stage">
            <Sketch entry={entry} />
          </div>
        )}
        {footer}
      </article>
    );
  }
  const viewport = designCardViewport(task.scene);
  return (
    <SketchComparison
      key={play}
      strokes={strokes}
      scene={task.scene}
      answer={group.answer}
      completed
      initialMode="drawing"
      animateDrawingFor={task.id}
      showReplay={false}
      showModes={false}
      unrestrictedDrawing
      compactCard={!legacy}
      viewport={viewport}
      cardFooter={footer}
      stageOverlay={
        <button
          type="button"
          className="gallery-replay-trigger"
          aria-label="スケッチの動きをもう一度見る"
          onClick={() => setPlay((current) => current + 1)}
        />
      }
    />
  );
}

function EntryCard({
  entry,
  tab,
  legacy,
}: {
  entry: ReplicaRecord;
  tab: GalleryTab;
  legacy: boolean;
}) {
  const summary =
    entrySummary(entry, tab) ??
    (tab === "sketch" ? entry.description : entry.photoDescription);
  if (tab === "sketch") {
    const regionCount = entry.taskId
      ? (taskById[entry.taskId]?.scene.regions.length ?? 1)
      : 1;
    return (
      <>
        {legacy && (
          <div className="gallery-detail-actions">
            <DifficultyPill regionCount={regionCount} />
          </div>
        )}
        <div className="gallery-detail-scroll" tabIndex={-1}>
          <SketchReplay
            key={entry.id}
            entry={entry}
            summary={summary}
            legacy={legacy}
          />
        </div>
      </>
    );
  }

  return (
    <div
      className="gallery-detail-scroll replica-gallery-photo-scroll"
      tabIndex={-1}
    >
      <article className="replica-gallery-photo-card">
        <img
          className="replica-gallery-photo-preview"
          src={entry.photo}
          alt={entry.samplePhoto ? "見本写真" : "撮影した写真"}
        />
        <div className="replica-gallery-photo-metadata">
          <h2>{entry.animalName ?? "動物"}</h2>
          <div>
            <p>
              <img
                src={assetPath(
                  "illustrations/pdf-design/camera-review-date.svg",
                )}
                alt=""
              />
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleDateString("ja-JP")}
              </time>
            </p>
            <p>
              <img
                src={assetPath(
                  "illustrations/pdf-design/camera-review-location.svg",
                )}
                alt=""
              />
              {entry.photoLocation || galleryPhotoLocation}
            </p>
          </div>
        </div>
        {summary && (
          <ZooCardSummary
            className="replica-gallery-photo-fact"
            text={summary}
          />
        )}
      </article>
    </div>
  );
}

export function ReplicaGallery({
  records,
  legacy = false,
  onBack,
  onCamera,
  onSettings,
}: {
  records: ReplicaRecord[];
  legacy?: boolean;
  onBack: () => void;
  onCamera: () => void;
  onSettings?: (trigger: HTMLButtonElement) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const sketchTab = useRef<HTMLButtonElement>(null);
  const photoTab = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<GalleryTab>("sketch");
  const [selected, setSelected] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const [shareMenu, setShareMenu] = useState(false);
  const [shareError, setShareError] = useState(false);
  const sharingCard = useRef(false);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const entries = records
    .filter((entry) => (legacy ? !!entry[tab] : !!entry.sketch))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeEntry = entries.find(
    (entry) => entry.id === selected && !!entry[tab],
  );
  const oppositeTab = tab === "sketch" ? "photo" : "sketch";
  const switchLabel = `${tabs[oppositeTab]}を見る`;
  const originalPhoto =
    tab === "photo" && !activeEntry?.samplePhoto
      ? activeEntry?.photo
      : undefined;

  useEffect(() => {
    const modal = dialog.current;
    if (activeEntry && modal && !modal.open) {
      modal.showModal();
      modal.querySelector<HTMLElement>(".gallery-detail-scroll")?.focus({
        preventScroll: true,
      });
    }
  }, [activeEntry]);

  function closeDetail() {
    dialog.current?.close();
    setSelected(undefined);
    setShareMenu(false);
    setShareError(false);
    const trigger = selectedButton.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    else
      (tab === "sketch" ? sketchTab : photoTab).current?.focus({
        preventScroll: true,
      });
  }

  async function saveFromGallery(action: () => Promise<boolean>) {
    if (sharingCard.current) return;
    const sourceDialog = dialog.current;
    sharingCard.current = true;
    setSharing(true);
    setShareMenu(false);
    setShareError(false);
    try {
      await action();
    } catch {
      if (dialog.current === sourceDialog) setShareError(true);
    } finally {
      sharingCard.current = false;
      setSharing(false);
    }
  }

  function shareCard(entry: ReplicaRecord, kind: GalleryTab) {
    const src = entry[kind];
    if (!src) return;
    void saveFromGallery(async () => {
      const { composeCardPng, savePng } = await import("../notebook/images");
      const response = await fetch(src);
      if (!response.ok) throw new Error("画像を読み込めませんでした。");
      const name = entry.animalName ?? "動物";
      const part = entry.taskId ? taskById[entry.taskId]?.part : undefined;
      const card = await composeCardPng(await response.blob(), {
        animalName: name,
        taskName: kind === "sketch" && part ? part : tabs[kind],
        createdAt: entry.createdAt,
        explanation: { form: entrySummary(entry, kind) ?? "" },
      });
      return savePng(card, `ズーケッチ-${name}-${tabs[kind]}.png`);
    });
  }

  return (
    <section
      className="drawing-collection gallery-screen replica-gallery"
      data-tab={tab}
      data-figma-node={tab === "photo" ? "66-10991" : "63-6390"}
      aria-labelledby={id}
    >
      <header className="gallery-header">
        <button
          className="replica-gallery-back"
          type="button"
          onClick={onBack}
          aria-label="体験に戻る"
        >
          <ChevronLeft aria-hidden="true" size={29} />
        </button>
        <h1 id={id}>マイギャラリー</h1>
        {onSettings && (
          <button
            type="button"
            className="replica-gallery-settings"
            aria-label="マイページ"
            onClick={(event) => onSettings(event.currentTarget)}
          >
            <span
              aria-hidden="true"
              style={{
                maskImage: `url("${assetPath("illustrations/pdf-design/camera-profile.svg")}")`,
                WebkitMaskImage: `url("${assetPath("illustrations/pdf-design/camera-profile.svg")}")`,
              }}
            />
          </button>
        )}
      </header>
      <div className="gallery-sheet">
        <div
          className="gallery-tabs"
          role="tablist"
          aria-label="ギャラリーの表示"
          onKeyDown={(event) => {
            const other = tab === "sketch" ? "photo" : "sketch";
            const choices = {
              Home: "sketch",
              End: "photo",
              ArrowLeft: other,
              ArrowRight: other,
            } as const;
            const next = choices[event.key as keyof typeof choices];
            if (!next) return;
            event.preventDefault();
            setTab(next);
            (next === "sketch" ? sketchTab : photoTab).current?.focus();
          }}
        >
          {(["sketch", "photo"] as const).map((item) => (
            <button
              key={item}
              type="button"
              ref={item === "sketch" ? sketchTab : photoTab}
              id={`${id}-${item}-tab`}
              role="tab"
              aria-controls={`${id}-${item}-panel`}
              aria-selected={tab === item}
              aria-label={tabs[item]}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
            >
              <Mark name={item} />
              <span
                className={`replica-gallery-tab-label replica-gallery-tab-label--${item}`}
              >
                <Furi text={tabs[item]} label={false} />
              </span>
            </button>
          ))}
        </div>
        <div
          className="replica-gallery-panel"
          id={`${id}-${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab}-tab`}
        >
          <div className="collection-grid" key={tab}>
            {entries.map((entry) =>
              entry[tab] ? (
                <article
                  className="collection-card"
                  data-photo-sparkle={
                    tab === "photo" && entry.animalName === "キリン"
                      ? true
                      : undefined
                  }
                  key={entry.id}
                  data-record-id={entry.id}
                >
                  <button
                    className="collection-open"
                    type="button"
                    onClick={(event) => {
                      selectedButton.current = event.currentTarget;
                      setShareError(false);
                      setSelected(entry.id);
                    }}
                    aria-label={`${entry.animalName ?? "動物"}の${tabs[tab]}を見る`}
                  >
                    {tab === "sketch" ? (
                      <Sketch entry={entry} />
                    ) : (
                      <img
                        className="replica-photo-tile"
                        data-sample={entry.samplePhoto || undefined}
                        src={entry.photo}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </button>
                </article>
              ) : (
                <div
                  className="gallery-slot"
                  data-record-id={entry.id}
                  aria-hidden="true"
                  key={entry.id}
                />
              ),
            )}
            {Array.from({ length: Math.max(0, 6 - entries.length) }, (_, i) => (
              <div className="gallery-slot" aria-hidden="true" key={i} />
            ))}
          </div>
          {!entries.some((entry) => entry[tab]) && (
            <p className="sr-only">{tabs[tab]}はまだありません。</p>
          )}
        </div>
      </div>
      <button
        type="button"
        className="gallery-camera"
        onClick={onCamera}
        aria-label="写真を撮る"
      >
        <Mark name="camera" />
        <span className="replica-gallery-camera-label">写真を撮る</span>
      </button>
      {activeEntry && (
        <dialog
          ref={dialog}
          className={`gallery-detail replica-gallery-detail replica-gallery-detail--${tab}`}
          aria-label={`${activeEntry.animalName ?? "動物"}の${tabs[tab]}`}
          onCancel={(event) => {
            event.preventDefault();
            closeDetail();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <button
            className="replica-gallery-close"
            type="button"
            onClick={closeDetail}
            aria-label="一覧に戻る"
          >
            <Mark name="close" />
          </button>
          {!legacy && (
            <div className="gallery-card-controls">
              <button
                type="button"
                aria-label={switchLabel}
                disabled={sharing || !activeEntry[oppositeTab]}
                onClick={() => {
                  setShareMenu(false);
                  setShareError(false);
                  setTab(oppositeTab);
                }}
              >
                {switchLabel}
              </button>
              <button
                type="button"
                disabled={sharing}
                aria-label="共有"
                aria-expanded={originalPhoto ? shareMenu : undefined}
                onClick={() => {
                  if (originalPhoto) setShareMenu((open) => !open);
                  else shareCard(activeEntry, tab);
                }}
              >
                <Share aria-hidden="true" size={19} />
              </button>
              {shareMenu && originalPhoto && (
                <div className="gallery-share-options" aria-label="画像の保存">
                  <button
                    type="button"
                    aria-label="カードを保存"
                    onClick={() => shareCard(activeEntry, tab)}
                  >
                    カードを保存
                  </button>
                  <button
                    type="button"
                    aria-label="写真を端末に保存"
                    onClick={() =>
                      void saveFromGallery(() =>
                        saveCapturedPhoto(originalPhoto, activeEntry.createdAt),
                      )
                    }
                  >
                    写真を端末に保存
                  </button>
                </div>
              )}
              {shareError && <p role="alert">カードを保存できませんでした。</p>}
            </div>
          )}
          <EntryCard entry={activeEntry} tab={tab} legacy={legacy} />
        </dialog>
      )}
    </section>
  );
}
