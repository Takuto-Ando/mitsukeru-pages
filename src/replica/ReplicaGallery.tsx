import { ZooCardSummary } from "../components/ZooCardSummary";
import { photoReviewSummary } from "../content/photoReviewSummaries";
import {
  zooAnimalIdByName,
  zooAnimalSummary,
} from "../content/zooAnimalSummaries";
import type { Stroke, StrokeStyle } from "../types";
import { Furi } from "../furigana/Furigana";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, Share } from "lucide-react";
import { assetPath } from "../content/artwork";
import { taskById } from "../content/tasks";
import { challengeTitle } from "../content/challengeTitle";
import { groups } from "../content/groups";
import { penColorsFor } from "../content/sketchPresentation";
import { applyStyles } from "../drawing/styles";
import { designCardViewport } from "../drawing/viewport";
import { DifficultyPill } from "../components/DifficultyPill";
import { SketchComparison } from "../components/SketchComparison";
import { SketchResultCardFooter } from "../components/SketchResultCardFooter";
import { galleryPhotoLocation } from "./storage";
import { downloadBlob } from "../notebook/download";
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

type PreparedShare = {
  entry: ReplicaRecord;
  tab: GalleryTab;
  file?: File;
};

async function prepareGalleryShare(
  entry: ReplicaRecord,
  tab: GalleryTab,
  signal: AbortSignal,
) {
  const src = entry[tab];
  if (!src) throw Error("Missing gallery image");
  const response = await fetch(src, { signal });
  if (!response.ok) throw Error("Unable to read gallery image");
  const image = await response.blob();
  const name = entry.animalName ?? "動物";
  if (tab === "photo" && !entry.samplePhoto) {
    const extension = image.type === "image/png" ? "png" : "jpg";
    return new File(
      [image],
      `zooketch-photo-${entry.createdAt.slice(0, 10)}.${extension}`,
      { type: image.type },
    );
  }
  const { composeCardPng } = await import("../notebook/images");
  const task = entry.taskId ? taskById[entry.taskId] : undefined;
  const card = await composeCardPng(image, {
    animalName: name,
    taskName:
      tab === "sketch" && task
        ? challengeTitle(task.id, name, task.part)
        : tabs[tab],
    createdAt: entry.createdAt,
    explanation: { form: entrySummary(entry, tab) ?? "" },
  });
  return new File([card], `ズーケッチ-${name}-${tabs[tab]}.png`, {
    type: "image/png",
  });
}

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

const legacyPaperColors = [
  [250, 247, 236],
  [255, 254, 248],
];
const paperChannels = ["feFuncR", "feFuncG", "feFuncB"] as const;
const paperTables = legacyPaperColors.map((color) =>
  color.map((channel) =>
    Array.from({ length: 256 }, (_, value) => (value === channel ? 1 : 0)).join(
      " ",
    ),
  ),
);

function SketchPaperFilter({ id }: { id: string }) {
  return (
    <svg
      className="replica-sketch-paper-filter"
      width="0"
      height="0"
      aria-hidden="true"
    >
      <filter id={id} colorInterpolationFilters="sRGB">
        {paperTables.map((channels, index) => (
          <Fragment key={index}>
            <feComponentTransfer in="SourceGraphic" result={`match-${index}`}>
              {paperChannels.map((Channel, channel) => (
                <Channel
                  key={Channel}
                  type="discrete"
                  tableValues={channels[channel]}
                />
              ))}
            </feComponentTransfer>
            {/* Paint opaque white only where all three channels match. */}
            <feColorMatrix
              in={`match-${index}`}
              values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 1 1 0 -2"
              result={`paper-${index}`}
            />
          </Fragment>
        ))}
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          {paperTables.map((_, index) => (
            <feMergeNode key={index} in={`paper-${index}`} />
          ))}
        </feMerge>
      </filter>
    </svg>
  );
}

function Sketch({
  entry,
  paperFilterId,
}: {
  entry: ReplicaRecord;
  paperFilterId?: string;
}) {
  const scene = entry.taskId ? taskById[entry.taskId]?.scene : undefined;
  const viewport = scene && designCardViewport(scene);
  const paperFilter = paperFilterId ? `url("#${paperFilterId}")` : undefined;
  if (!scene || (!viewport && !paperFilter)) {
    return (
      <img
        className="replica-sketch-image"
        src={entry.sketch}
        alt=""
        decoding="async"
        style={{ filter: paperFilter }}
      />
    );
  }
  // Keep the paper card crop inside the saved image at every screen width.
  const sceneWidth = 600;
  const sceneHeight = scene.frameHeight || 400;
  const width = Math.min(viewport?.width ?? sceneWidth, sceneWidth);
  const height = Math.min(viewport?.height ?? sceneHeight, sceneHeight);
  const x = Math.max(0, Math.min(viewport?.x ?? 0, sceneWidth - width));
  const y = Math.max(0, Math.min(viewport?.y ?? 0, sceneHeight - height));
  return (
    <svg
      className="replica-sketch-image"
      viewBox={`${x} ${y} ${width} ${height}`}
      preserveAspectRatio={viewport ? "none" : "xMidYMid slice"}
      aria-hidden="true"
    >
      <image
        href={entry.sketch}
        width={sceneWidth}
        height={sceneHeight}
        filter={paperFilter}
      />
    </svg>
  );
}

function entrySummary(entry: ReplicaRecord, tab: GalleryTab, legacy = false) {
  const task = entry.taskId ? taskById[entry.taskId] : undefined;
  const groupId =
    entry.groupId ??
    task?.groupId ??
    zooAnimalIdByName(entry.animalName) ??
    (entry.samplePhoto ? "giraffe" : undefined);
  if (tab === "photo" && !legacy) return photoReviewSummary(groupId);
  return zooAnimalSummary(groupId, tab === "sketch" ? task?.id : undefined);
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
  const animal = entry.animalName ?? group?.name ?? "動物";
  const footer = legacy ? (
    summary && (
      <div className="gallery-detail-fact">
        <ZooCardSummary text={summary} />
      </div>
    )
  ) : (
    <SketchResultCardFooter
      title={
        task
          ? challengeTitle(task.id, animal, task.part)
          : `${animal}のスケッチ`
      }
      taskId={task?.id}
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
    entrySummary(entry, tab, legacy) ??
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
            fitLines={!legacy}
          />
        )}
      </article>
    </div>
  );
}

export function ReplicaGallery({
  records,
  legacy = false,
  deviceSaveEnabled = true,
  onBack,
  onCamera,
  onSettings,
}: {
  records: ReplicaRecord[];
  legacy?: boolean;
  deviceSaveEnabled?: boolean;
  onBack: () => void;
  onCamera: () => void;
  onSettings?: (trigger: HTMLButtonElement) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sketchTab = useRef<HTMLButtonElement>(null);
  const photoTab = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<GalleryTab>("sketch");
  const [selected, setSelected] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const [preparedShare, setPreparedShare] = useState<PreparedShare>();
  const [shareAttempt, setShareAttempt] = useState(0);
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
  const paperFilterId = !legacy && tab === "sketch" ? `${id}-paper` : undefined;
  const switchLabel = `${tabs[oppositeTab]}を見る`;
  const share =
    preparedShare?.entry === activeEntry && preparedShare?.tab === tab
      ? preparedShare
      : undefined;

  useEffect(() => {
    const list = panel.current;
    if (
      legacy ||
      tab !== "photo" ||
      !list ||
      !window.matchMedia("(prefers-reduced-motion: no-preference)").matches
    )
      return;

    const observer = new IntersectionObserver(
      (items) => {
        for (const item of items) {
          if (item.intersectionRatio < 0.2) continue;
          item.target.setAttribute("data-photo-sparkle", "true");
          observer.unobserve(item.target);
        }
      },
      { root: list, threshold: 0.2 },
    );
    list
      .querySelectorAll(".collection-card:not([data-photo-sparkle])")
      .forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [legacy, records, tab]);

  useEffect(() => {
    const modal = dialog.current;
    if (activeEntry && modal && !modal.open) {
      modal.showModal();
      modal.querySelector<HTMLElement>(".gallery-detail-scroll")?.focus({
        preventScroll: true,
      });
    }
  }, [activeEntry]);

  useEffect(() => {
    if (!deviceSaveEnabled || legacy || !activeEntry) {
      setPreparedShare(undefined);
      return;
    }
    setPreparedShare(undefined);
    const controller = new AbortController();
    // Prepare the card in the background so sharing starts in the tap handler.
    void prepareGalleryShare(activeEntry, tab, controller.signal).then(
      (file) => {
        if (!controller.signal.aborted)
          setPreparedShare({ entry: activeEntry, tab, file });
      },
      () => {
        if (!controller.signal.aborted) {
          setPreparedShare({ entry: activeEntry, tab });
          setShareError(true);
        }
      },
    );
    return () => controller.abort();
  }, [activeEntry, tab, deviceSaveEnabled, legacy, shareAttempt]);

  function closeDetail() {
    dialog.current?.close();
    setSelected(undefined);
    setShareError(false);
    const trigger = selectedButton.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    else
      (tab === "sketch" ? sketchTab : photoTab).current?.focus({
        preventScroll: true,
      });
  }

  async function shareCard() {
    if (!share || sharingCard.current) return;
    setShareError(false);
    if (!share.file) {
      setShareAttempt((attempt) => attempt + 1);
      return;
    }
    const { file } = share;
    const sourceDialog = dialog.current;
    sharingCard.current = true;
    setSharing(true);
    try {
      const data = { files: [file] };
      if (navigator.share && navigator.canShare?.(data)) {
        try {
          await navigator.share(data);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
        }
      }
      downloadBlob(file, file.name);
    } catch {
      if (dialog.current === sourceDialog) setShareError(true);
    } finally {
      sharingCard.current = false;
      setSharing(false);
    }
  }

  return (
    <section
      className="drawing-collection gallery-screen replica-gallery"
      data-tab={tab}
      data-figma-node={tab === "photo" ? "66-10991" : "63-6390"}
      aria-labelledby={id}
    >
      {paperFilterId && <SketchPaperFilter id={paperFilterId} />}
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
          ref={panel}
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
                    legacy && tab === "photo" && entry.animalName === "キリン"
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
                      <Sketch entry={entry} paperFilterId={paperFilterId} />
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
                className="gallery-card-switch"
                type="button"
                aria-label={switchLabel}
                disabled={sharing || !activeEntry[oppositeTab]}
                onClick={() => {
                  setShareError(false);
                  setTab(oppositeTab);
                }}
              >
                <span className="gallery-card-switch-label">
                  <Mark name={oppositeTab} />
                  <Furi label={false} text={switchLabel} />
                </span>
              </button>
              {deviceSaveEnabled && (
                <button
                  className="gallery-card-save"
                  type="button"
                  disabled={sharing || !share}
                  aria-label="保存"
                  onClick={() => void shareCard()}
                >
                  <Share aria-hidden="true" size={24} />
                </button>
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
