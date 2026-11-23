import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { assetPath } from "../content/artwork";
import {
  downloadLiveModel,
  liveModelBytes,
  liveModelDownloadedBytes,
  liveModelProgressEvent,
} from "../recognition/liveModel";
import {
  downloadPhotoModel,
  photoModel,
  photoModelDownloadedBytes,
  photoModelProgressEvent,
} from "../recognition/photoModel";
import "./tutorial-model-download.css";

export function TutorialModelDownload({ onReady }: { onReady: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();

  useEffect(() => {
    const modal = dialog.current;
    if (modal && !modal.open) modal.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    let advance = 0;
    const update = () => {
      const bytes =
        Math.min(liveModelBytes, liveModelDownloadedBytes()) +
        Math.min(photoModel.bytes, photoModelDownloadedBytes());
      setProgress(
        Math.min(
          99,
          Math.floor((100 * bytes) / (liveModelBytes + photoModel.bytes)),
        ),
      );
    };

    window.addEventListener(liveModelProgressEvent, update);
    window.addEventListener(photoModelProgressEvent, update);
    // Keep the meter at its start position for the first paint, even if both
    // files are already cached.
    let start = requestAnimationFrame(() => {
      start = requestAnimationFrame(() => {
        update();
        void Promise.all([downloadLiveModel(), downloadPhotoModel()]).then(
          () => {
            if (!active) return;
            setProgress(100);
            advance = window.setTimeout(onReady, 240);
          },
          () => {
            if (active) setFailed(true);
          },
        );
      });
    });

    return () => {
      active = false;
      window.removeEventListener(liveModelProgressEvent, update);
      window.removeEventListener(photoModelProgressEvent, update);
      cancelAnimationFrame(start);
      window.clearTimeout(advance);
    };
  }, [attempt, onReady]);

  return (
    <dialog
      ref={dialog}
      className="tutorial-model-download"
      aria-labelledby={title}
      onCancel={(event) => event.preventDefault()}
    >
      <h1 id={title}>Now Loading...</h1>
      {!failed && (
        <p className="tutorial-model-caption">
          画像認識モデルをダウンロード中…
        </p>
      )}
      <div
        className="tutorial-model-meter"
        role="progressbar"
        aria-label="画像認識モデルのダウンロード"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ "--model-download-progress": `${progress}%` } as CSSProperties}
      >
        <div className="tutorial-model-meter-track">
          <div className="tutorial-model-meter-fill" />
        </div>
        <div className="tutorial-model-meter-range">
          <img
            className="tutorial-model-meter-pitsune"
            src={assetPath("figma/entry/camera-face.svg")}
            alt=""
            draggable={false}
          />
        </div>
      </div>
      {failed && (
        <div className="tutorial-model-retry">
          <p role="alert">通信を確認して、もう一度試してね。</p>
          <button
            className="design3-pill"
            type="button"
            onClick={() => {
              setFailed(false);
              setProgress(0);
              setAttempt((previous) => previous + 1);
            }}
          >
            もう一度試す
          </button>
        </div>
      )}
    </dialog>
  );
}
