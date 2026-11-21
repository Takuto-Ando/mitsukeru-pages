import { ZooCardSummary } from "../components/ZooCardSummary";
import { zooAnimalIdByName, zooAnimalSummary } from "../content/zooAnimalSummaries";
import type { Stroke } from "../types";
import { CardLettering } from "../components/CardLettering";
import { useEffect, useId, useRef, useState } from "react";
import { assetPath } from "../content/artwork";
import { taskById } from "../content/tasks";
import { designCardViewport } from "../drawing/viewport";
import { DifficultyPill } from "../components/DifficultyPill";
import { galleryPhotoLocation } from "./storage";
import "../styles/design3-gallery.css";
import "./replica-gallery.css";

export interface ReplicaRecord {
  id: string;
  createdAt: string;
  photo?: string;
  sketch?: string;
  strokes?: Stroke[];
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
  // Stored PNGs use the whole scene. Match the crop of the original paper card.
  return (
    <svg
      className="replica-sketch-image"
      viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <image
        href={entry.sketch}
        width="600"
        height={scene.frameHeight || 400}
      />
    </svg>
  );
}

function EntryCard({ entry, tab }: { entry: ReplicaRecord; tab: GalleryTab }) {
  const task = entry.taskId ? taskById[entry.taskId] : undefined;
  const summary = zooAnimalSummary(
    entry.groupId ?? task?.groupId ?? zooAnimalIdByName(entry.animalName) ?? (entry.samplePhoto ? "giraffe" : undefined),
    tab === "sketch" ? task?.id : undefined,
  );
  if (tab === "sketch") {
    const regionCount = entry.taskId
      ? (taskById[entry.taskId]?.scene.regions.length ?? 1)
      : 1;
    return (
      <>
        <div className="gallery-detail-actions">
          <DifficultyPill regionCount={regionCount} />
        </div>
        <div className="gallery-detail-scroll" tabIndex={-1} autoFocus>
          <article className="sketch-comparison-card">
            <Sketch entry={entry} />
            {summary && (
              <div className="gallery-detail-fact">
                <ZooCardSummary text={summary} />
              </div>
            )}
          </article>
        </div>
      </>
    );
  }

  return (
    <div
      className="gallery-detail-scroll replica-gallery-photo-scroll"
      tabIndex={-1}
      autoFocus
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
        {summary && <ZooCardSummary className="replica-gallery-photo-fact" text={summary} />}
      </article>
    </div>
  );
}

export function ReplicaGallery({
  records,
  onBack,
  onCamera,
}: {
  records: ReplicaRecord[];
  onBack: () => void;
  onCamera: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const sketchTab = useRef<HTMLButtonElement>(null);
  const photoTab = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<GalleryTab>("sketch");
  const [selected, setSelected] = useState<string>();
  const entries = records
    .filter((entry) => !!entry[tab])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeEntry = entries.find((entry) => entry.id === selected);

  useEffect(() => {
    const modal = dialog.current;
    if (activeEntry && modal && !modal.open) modal.showModal();
  }, [activeEntry]);

  function closeDetail() {
    dialog.current?.close();
    setSelected(undefined);
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
          <span aria-hidden="true">‹</span>
        </button>
        <h1 id={id}>
          <span className="sr-only">マイギャラリー</span>
          <Mark name="title" />
        </h1>
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
              {item === "photo" ? (
                <CardLettering
                  className="gallery-photo-name"
                  src={assetPath("figma/entry/gallery-photo-label.svg")}
                  text="写真"
                />
              ) : (
                <Mark name="sketch-label" />
              )}
            </button>
          ))}
        </div>
        <div
          id={`${id}-${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab}-tab`}
        >
          <div className="collection-grid">
            {entries.map((entry) => (
              <article
                className="collection-card"
                data-photo-sparkle={
                  tab === "photo" && entry.animalName === "キリン"
                    ? true
                    : undefined
                }
                key={entry.id}
              >
                <button
                  className="collection-open"
                  type="button"
                  onClick={() => setSelected(entry.id)}
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
            ))}
            {Array.from({ length: Math.max(0, 6 - entries.length) }, (_, i) => (
              <div className="gallery-slot" aria-hidden="true" key={i} />
            ))}
          </div>
          {!entries.length && (
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
        <CardLettering
          className="gallery-photo-action"
          src={assetPath("figma/entry/gallery-camera-label.svg")}
          text="写真を撮る"
        />
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
          <EntryCard entry={activeEntry} tab={tab} />
        </dialog>
      )}
    </section>
  );
}
