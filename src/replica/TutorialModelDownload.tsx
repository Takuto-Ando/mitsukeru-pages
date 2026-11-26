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

function downloadProgress(live: boolean, photo: boolean) {
  const liveBytes = live ? liveModelBytes : 0;
  const photoBytes = photo ? photoModel.bytes : 0;
  const bytes =
    Math.min(liveBytes, liveModelDownloadedBytes()) +
    Math.min(photoBytes, photoModelDownloadedBytes());
  return Math.min(99, Math.floor((100 * bytes) / (liveBytes + photoBytes)));
}

function modelProgressEvents(update: () => void) {
  window.addEventListener(liveModelProgressEvent, update);
  window.addEventListener(photoModelProgressEvent, update);
  return () => {
    window.removeEventListener(liveModelProgressEvent, update);
    window.removeEventListener(photoModelProgressEvent, update);
  };
}

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
    const update = () => setProgress(downloadProgress(true, true));
    const unsubscribe = modelProgressEvents(update);
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
      unsubscribe();
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
      <h1 id={title}>Now Loading…</h1>
      <ModelDownloadContent
        progress={progress}
        onRetry={
          failed
            ? () => {
                setFailed(false);
                setProgress(0);
                setAttempt((previous) => previous + 1);
              }
            : undefined
        }
      />
    </dialog>
  );
}

export function CameraModelDownload({
  live,
  photo,
  deferred,
  onRetry,
}: {
  live: boolean;
  photo: boolean;
  deferred: boolean;
  onRetry?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const title = useId();
  useEffect(() => {
    if (!(live || photo)) return;
    const update = () => setProgress(downloadProgress(live, photo));
    update();
    return modelProgressEvents(update);
  }, [live, photo]);

  return (
    <section
      className="tutorial-model-download tutorial-model-download--camera"
      aria-labelledby={title}
    >
      <h2 id={title}>Now Loading…</h2>
      <ModelDownloadContent
        progress={live || photo ? progress : 0}
        onRetry={onRetry}
        deferred={deferred}
      />
    </section>
  );
}

function ModelDownloadContent({
  progress,
  onRetry,
  deferred,
}: {
  progress: number;
  onRetry?: () => void;
  deferred?: boolean;
}) {
  return (
    <>
      {!onRetry && (
        <p className="tutorial-model-caption">
          画像識別モデルをダウンロード中…
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
      {onRetry && (
        <div className="tutorial-model-retry">
          {deferred ? (
            <p>画像認識モデルは約87 MBです。Wi-Fiをおすすめします。</p>
          ) : (
            <p role="alert">通信を確認して、もう一度試してね。</p>
          )}
          <button className="design3-pill" type="button" onClick={onRetry}>
            {deferred ? "ダウンロード" : "もう一度試す"}
          </button>
        </div>
      )}
    </>
  );
}
