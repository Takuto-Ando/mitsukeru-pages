import { ZooCardSummary } from "../components/ZooCardSummary";
import { zooAnimalSummary } from "../content/zooAnimalSummaries";
import { Check, CornerDownLeft, Pencil, Search } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";
import { PhotoRecognitionGuide } from "../components/ChallengeIntro";
import { assetPath } from "../content/artwork";
import type { ObservationGroup } from "../content/groups";
import { normalizeAnimalSearch } from "../content/animalNameSearch";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import { usePhotoIdentification } from "../recognition/usePhotoIdentification";
import type { CameraCapture } from "./ReplicaCamera";
import "./photo-review.css";

export function ReplicaPhotoReview({
  photo,
  recognitionInput,
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
  recognitionInput?: CameraCapture["recognitionInput"];
  sample: boolean;
  createdAt?: string;
  photoLocation?: string;
  saved: boolean;
  group?: ObservationGroup;
  choices: ObservationGroup[];
  figmaFlow?: "tutorial" | "regular";
  onSelect: (id: string, speciesId?: string) => void;
  onRetake: () => void;
  canRetake?: boolean;
  onConfirm: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { candidates, message } = usePhotoIdentification(
    figmaFlow && !sample && !confirmed
      ? (recognitionInput?.full ?? photo)
      : undefined,
    recognitionInput?.crop,
    recognitionInput?.tiles,
  );
  const edit = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const reviewNodes =
    figmaFlow === "tutorial"
      ? { success: "43-1815", unknown: "52-5265", edit: "63-6420" }
      : { success: "66-7554", unknown: "66-7655", edit: "66-7604" };
  const fact = zooAnimalSummary(group?.id);
  const search = normalizeAnimalSearch(query);
  const matchingCandidates = (candidates ?? []).flatMap(
    ({ groupId, speciesId }) => {
      const choice = choices.find(({ id }) => id === groupId);
      const name = figmaFlow
        ? choice?.name
        : (kyotoSpeciesById.get(speciesId ?? groupId)?.name ?? choice?.name);
      return choice && name && normalizeAnimalSearch(name).includes(search)
        ? [{ groupId, speciesId, name }]
        : [];
    },
  );
  const matchingAnimals = choices.filter(
    ({ id, name }) =>
      normalizeAnimalSearch(name).includes(search) &&
      !matchingCandidates.some(
        (candidate) => candidate.groupId === id && candidate.name === name,
      ),
  );
  function closePicker() {
    setEditing(false);
    setQuery("");
    edit.current?.focus();
  }
  function select(id: string, speciesId?: string) {
    setConfirmed(true);
    onSelect(id, speciesId);
    closePicker();
  }
  const animalName = group?.name ?? "？？？？？";
  const photoHeading = photo
    ? saved
      ? figmaFlow
        ? "写真をギャラリーに保存しました。"
        : "写真をアルバムに保存しました。"
      : "撮影した写真を確認する"
    : "観察する動物を選ぶ";
  const savedHeading = !!(figmaFlow && photo && saved);
  const confirmLabel = figmaFlow ? "描いてもらう" : "ピツネに見せる";
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
      <h1
        id="replica-photo-heading"
        data-photo-saved={savedHeading || undefined}
      >
        <span className="replica-photo-heading-content">
          {savedHeading && (
            <span className="replica-photo-saved-check" aria-hidden="true">
              <Check size={18} strokeWidth={2} />
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
              <div className="replica-photo-picker-search">
                <Search aria-hidden="true" size={17} />
                <input
                  type="search"
                  aria-label="動物の名前で探す"
                  placeholder="動物の名前で探す"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {matchingCandidates.length > 0 && (
                <ul aria-label="写真から見つけた候補">
                  {matchingCandidates.map(({ groupId, speciesId, name }) => (
                    <li key={speciesId ?? groupId}>
                      <button
                        className="photo-picker-candidate"
                        type="button"
                        aria-pressed={
                          group?.id === groupId && animalName === name
                        }
                        onClick={() => select(groupId, speciesId)}
                      >
                        <span>{name}</span>
                        <span className="photo-picker-candidate-tag">候補</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ul aria-label="動物の一覧">
                {matchingAnimals.map(({ id, name }) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={group?.id === id}
                      onClick={() => select(id)}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
              {matchingAnimals.length === 0 &&
                matchingCandidates.length === 0 && (
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
      {message && (
        <p className="replica-photo-recognition-note" role="status">
          {message}
        </p>
      )}
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
          aria-label={confirmLabel}
          disabled={!group}
          onClick={onConfirm}
        >
          <img
            alt=""
            src={assetPath("figma/entry/confirm.svg")}
            width={18.5146}
            height={17}
          />
          <span>{confirmLabel}</span>
        </button>
      </div>
    </section>
  );
}
