import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { groups } from "../content/groups";
import type { Candidate } from "../recognition/labels";
import { assetPath } from "../content/artwork";

export function PhotoReview({
  photo,
  takenAt,
  selection,
  candidates,
  onChange,
  onRetake,
  onConfirm,
}: {
  photo: string;
  takenAt?: Date;
  selection?: Pick<Candidate, "groupId" | "speciesId">;
  candidates: Candidate[];
  onChange: (choice: Pick<Candidate, "groupId" | "speciesId">) => void;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const group = groups.find((item) => item.id === selection?.groupId);
  const name = selection?.speciesId === "sheep" ? "ヒツジ" : group?.name;
  function select(choice: Pick<Candidate, "groupId" | "speciesId">) {
    onChange(choice);
    setChoosing(false);
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
        {photo ? (
          <img
            className="captured-preview"
            src={photo}
            alt="撮影した動物の写真"
          />
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
              <ul
                id="photo-animal-options"
                className="design3-photo-options"
                aria-label="動物の一覧"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setChoosing(false);
                    editButton.current?.focus();
                  }
                }}
              >
                {groups.map((item) => {
                  const candidate = candidates.find(
                    (option) => option.groupId === item.id,
                  );
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={
                          item.id === group?.id &&
                          selection?.speciesId !== "sheep"
                        }
                        aria-description={
                          candidate && candidate.speciesId !== "sheep"
                            ? "AIの候補"
                            : undefined
                        }
                        onClick={() => select({ groupId: item.id })}
                      >
                        {item.name}
                      </button>
                      {candidate?.speciesId === "sheep" && (
                        <button
                          type="button"
                          aria-pressed={selection?.speciesId === "sheep"}
                          aria-description="AIの候補"
                          onClick={() => select(candidate)}
                        >
                          ヒツジ
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
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
          {group?.fact ?? "?????"}
        </p>
      </article>
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
