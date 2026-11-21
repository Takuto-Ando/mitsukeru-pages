import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { groups } from "../content/groups";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import type { Candidate } from "../recognition/labels";
import { assetPath } from "../content/artwork";
import { PhotoRecognitionGuide, PhotoSparkle } from "./ChallengeIntro";
import { Furi } from "../furigana/Furigana";

const speciesName = (choice: Pick<Candidate, "groupId" | "speciesId">) =>
  kyotoSpeciesById.get(choice.speciesId ?? choice.groupId)?.name ??
  groups.find((entry) => entry.id === choice.groupId)?.name;

const pickerChoices = [
  ...groups.map((group) => ({
    groupId: group.id,
    name: group.name,
    speciesId: undefined as string | undefined,
  })),
  { groupId: "goat", speciesId: "sheep", name: "ヒツジ" },
];
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
    .trim();

export function PhotoReview({
  dopa = false,
  photo,
  recognized = false,
  takenAt,
  selection,
  candidates,
  onChange,
  onRetake,
  onConfirm,
}: {
  dopa?: boolean;
  photo: string;
  recognized?: boolean;
  takenAt?: Date;
  selection?: Pick<Candidate, "groupId" | "speciesId">;
  candidates: Candidate[];
  onChange: (choice: Pick<Candidate, "groupId" | "speciesId">) => void;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const group = groups.find((item) => item.id === selection?.groupId);
  const name = selection?.speciesId ? speciesName(selection) : group?.name;
  const search = normalize(query);
  const choices = pickerChoices.filter(
    (choice) =>
      normalize(choice.name).includes(search) ||
      normalize(speciesName(choice) ?? "").includes(search),
  );
  function select(choice: Pick<Candidate, "groupId" | "speciesId">) {
    onChange(choice);
    setChoosing(false);
    setQuery("");
    editButton.current?.focus();
  }
  return (
    <section
      className="design3-photo-review"
      aria-labelledby="photo-review-title"
    >
      <h1 id="photo-review-title">
        {photo ? "撮影した写真を確認する" : "観察する動物を選ぶ"}
      </h1>
      <article className="design3-photo-card">
        {dopa && photo && (
          <span className="dopa-snapshot" aria-hidden="true">
            カシャ！
          </span>
        )}
        {photo ? (
          <div className="photo-preview-wrap">
            <img
              className="captured-preview"
              src={photo}
              alt="撮影した動物の写真"
            />
            {recognized && (
              <>
                <PhotoRecognitionGuide />
                <PhotoSparkle />
              </>
            )}
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
            <h2>{name ?? "?????"}</h2>
            <button
              className="design3-photo-edit"
              type="button"
              ref={editButton}
              aria-label="修正"
              aria-expanded={choosing}
              aria-controls={choosing ? "photo-animal-options" : undefined}
              onClick={() => setChoosing(!choosing)}
            >
              <img
                alt=""
                src={assetPath(
                  "illustrations/pdf-design/camera-review-edit.svg",
                )}
              />
            </button>
            {choosing && (
              <div
                id="photo-animal-options"
                className="design3-photo-options photo-picker"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setChoosing(false);
                    editButton.current?.focus();
                  }
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
                  {choices.map(({ groupId, speciesId, name }) => (
                    <li key={speciesId ?? groupId}>
                      <button
                        type="button"
                        aria-pressed={
                          selection?.groupId === groupId &&
                          (selection?.speciesId === "sheep") ===
                            (speciesId === "sheep")
                        }
                        onClick={() => select({ groupId, speciesId })}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
                {choices.length === 0 && <p>名前が見つかりません。</p>}
              </div>
            )}
          </div>
          {takenAt && (
            <div className="design3-photo-date">
              <span>
                <img
                  alt=""
                  src={assetPath(
                    "illustrations/pdf-design/camera-review-date.svg",
                  )}
                />
                <time dateTime={takenAt.toISOString()}>
                  {takenAt.toLocaleDateString("ja-JP")}
                </time>
              </span>
              <span>
                <img
                  alt=""
                  src={assetPath(
                    "illustrations/pdf-design/camera-review-location.svg",
                  )}
                />
                京都市動物園
              </span>
            </div>
          )}
        </div>
        <p className="design3-photo-fact" aria-live="polite">
          {group?.fact ? <Furi text={group.fact} /> : "?????"}
        </p>
      </article>
      {!selection && candidates.length > 0 && (
        <div className="photo-ai-candidates" aria-label="写真から見つけた候補">
          {candidates.map((candidate) => (
            <button
              type="button"
              key={candidate.speciesId ?? candidate.groupId}
              className="design3-pill design3-pill--green"
              onClick={() => select(candidate)}
            >
              {speciesName(candidate)}
            </button>
          ))}
        </div>
      )}
      <div className="design3-actions">
        <button
          className="design3-pill design3-pill--green"
          aria-label={photo ? "もう一度撮る" : undefined}
          onClick={onRetake}
        >
          {photo ? (
            <img
              alt=""
              className="photo-review-retake-mark"
              src={assetPath(
                "illustrations/pdf-design/camera-review-retake.svg",
              )}
            />
          ) : (
            <>
              <RotateCcw size={17} aria-hidden="true" />
              カメラに戻る
            </>
          )}
        </button>
        <button
          className="design3-pill"
          aria-label="ピツネに見せる"
          disabled={!group}
          onClick={onConfirm}
        >
          <img
            alt=""
            className="photo-review-confirm-mark"
            src={assetPath(
              "illustrations/pdf-design/camera-review-confirm.svg",
            )}
          />
        </button>
      </div>
      {photo && <p className="quiet-note">撮影写真は端末に保存しません。</p>}
    </section>
  );
}
