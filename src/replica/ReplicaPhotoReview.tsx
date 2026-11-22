import { ZooCardSummary } from "../components/ZooCardSummary";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import { Check, CornerDownLeft, Pencil } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";
import { PhotoRecognitionGuide } from "../components/ChallengeIntro";
import { assetPath } from "../content/artwork";
import type { ObservationGroup } from "../content/groups";
import { normalizeAnimalSearch } from "../content/animalNameSearch";
import "./photo-review.css";

export function ReplicaPhotoReview({
  photo,
  sample,
  createdAt,
  photoLocation,
  saved,
  group,
  choices,
  figmaFlow,
  onSelect,
  onRetake,
  canRetake = true,
  onConfirm,
}: {
  photo?: string;
  sample: boolean;
  createdAt?: string;
  photoLocation?: string;
  saved: boolean;
  group?: ObservationGroup;
  choices: ObservationGroup[];
  figmaFlow?: "tutorial" | "regular";
  onSelect: (id: string) => void;
  onRetake: () => void;
  canRetake?: boolean;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const edit = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const reviewNodes =
    figmaFlow === "tutorial"
      ? { success: "43-1815", unknown: "52-5265", edit: "63-6420" }
      : { success: "66-7554", unknown: "66-7655", edit: "66-7604" };
  const fact = zooAnimalSummary(group?.id);
  const search = normalizeAnimalSearch(query);
  const matchingAnimals = choices.filter(({ name }) =>
    normalizeAnimalSearch(name).includes(search),
  );
  function closePicker() {
    setEditing(false);
    setQuery("");
    edit.current?.focus();
  }
  const animalName = group?.name ?? "？？？？？";
  const photoHeading = photo
    ? saved
      ? "写真をアルバムに保存しました。"
      : "撮影した写真を確認する"
    : "観察する動物を選ぶ";
  const file = (name: string) =>
    assetPath("illustrations/pdf-design/camera-review-" + name + ".svg");
  return (
    <section
      className="design3-photo-review"
      data-figma-node={
        figmaFlow
          ? reviewNodes[editing ? "edit" : group ? "success" : "unknown"]
          : undefined
      }
      aria-labelledby="replica-photo-heading"
    >
      <h1 id="replica-photo-heading">
        <span className="replica-photo-heading-content">
          {figmaFlow && photo && saved && (
            <span className="replica-photo-saved-check" aria-hidden="true">
              <Check size={20} strokeWidth={3} />
            </span>
          )}
          <span>{photoHeading}</span>
        </span>
      </h1>
      <article
        className="design3-photo-card"
        data-photo-shine={photo ? true : undefined}
      >
        {photo ? (
          <div className="photo-preview-wrap">
            <img
              className="captured-preview"
              src={photo}
              alt={sample ? "見本写真のキリン" : "撮影した動物の写真"}
            />
            {sample && group?.id === "giraffe" && <PhotoRecognitionGuide />}
          </div>
        ) : (
          <div className="design3-photo-placeholder">
            <img
              alt=""
              src={assetPath("illustrations/pdf-design/camera-placeholder.svg")}
            />
          </div>
        )}
        <div className="design3-photo-meta">
          <div className="design3-photo-animal">
            <h2
              style={
                {
                  "--photo-name-length": Array.from(animalName).length,
                } as CSSProperties
              }
            >
              {animalName}
            </h2>
            <button
              className="design3-photo-edit"
              type="button"
              ref={edit}
              aria-label="修正"
              aria-controls={editing ? optionsId : undefined}
              aria-expanded={editing}
              onClick={() => (editing ? closePicker() : setEditing(true))}
            >
              <Pencil
                aria-hidden="true"
                className="photo-review-edit-icon"
                size={8.5}
              />
              <span>修正</span>
            </button>
          </div>
          {editing && (
            <div
              id={optionsId}
              className="design3-photo-options photo-picker replica-photo-picker"
              onKeyDown={(event) => {
                if (event.key === "Escape") closePicker();
              }}
            >
              <input
                type="search"
                aria-label="動物の名前で探す"
                placeholder="動物の名前で探す"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <ul aria-label="動物の一覧">
                {matchingAnimals.map(({ id, name }) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={group?.id === id}
                      onClick={() => {
                        onSelect(id);
                        closePicker();
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
              {matchingAnimals.length === 0 && (
                <p role="status">名前が見つかりません。</p>
              )}
            </div>
          )}
          {createdAt && (
            <div className="design3-photo-date">
              <span>
                <img alt="" src={file("date")} />
                <time dateTime={createdAt}>
                  {new Date(createdAt).toLocaleDateString("ja-JP")}
                </time>
              </span>
              {photoLocation && (
                <span>
                  <img alt="" src={file("location")} />
                  {photoLocation}
                </span>
              )}
            </div>
          )}
        </div>
        {fact && <ZooCardSummary className="design3-photo-fact" text={fact} />}
      </article>
      <div className="design3-actions">
        <button
          className="design3-pill design3-pill--green"
          aria-label="撮りなおす"
          disabled={!canRetake}
          onClick={onRetake}
        >
          <CornerDownLeft aria-hidden="true" width={21} height={20} />
          <span>撮りなおす</span>
        </button>
        <button
          className="design3-pill"
          aria-label="ピツネに見せる"
          disabled={!group}
          onClick={onConfirm}
        >
          <img
            alt=""
            src={assetPath("figma/entry/confirm.svg")}
            width={18.5146}
            height={17}
          />
          <span>ピツネに見せる</span>
        </button>
      </div>
    </section>
  );
}
