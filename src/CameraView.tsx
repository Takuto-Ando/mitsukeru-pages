import { challengeProvider } from "./domain";
import { recordStudy } from "./research/study";
import { canAutoSelect, type Candidate } from "./recognition/labels";
import { PhotoReview } from "./components/PhotoReview";
import { PhotoCelebration } from "./components/ChallengeIntro";
import { assetPath } from "./content/artwork";
import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { photoModelCached } from "./recognition/photoModel";
import { downloadLiveModel } from "./recognition/liveModel";
import {
  useLiveDetection,
  useLiveModelCached,
} from "./recognition/useLiveDetection";
import { speciesRecognizer } from "./recognition/species";
import { PHOTO_FRAMES, drawPhotoFrame, frameSvg } from "./future/frames";

import { CameraShutter, CameraZoom } from "./components/CameraControls";
import { drawCameraFrame, useCameraZoom } from "./camera/zoom";

export function CameraView({
  dopa = false,
  onCapture,
  onSelect,
  onCollection,
  onSettings,
  suspended = false,
  tutorial = false,
  celebrating = false,
  onFreeDraw,
}: {
  dopa?: boolean;
  onCapture?: () => void;
  suspended?: boolean;
  tutorial?: boolean;
  celebrating?: boolean;
  onFreeDraw: () => void;
  onCollection?: () => void;
  onSettings?: (trigger: HTMLButtonElement) => void;
  onSelect: (
    photo: string,
    taskId: string,
    method: "manual" | "automatic",
  ) => void;
}) {
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  const [takenAt, setTakenAt] = useState<Date>();
  const [selection, setSelection] = useState<{
    choice: Pick<Candidate, "groupId" | "speciesId">;
    method: "manual" | "automatic";
  }>();
  const manuallySelected = useRef(false);

  const [frameId, setFrameId] = useState<string>("");
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack>();
  const cameraZoom = useCameraZoom(cameraTrack);
  const [captured, setCaptured] = useState("");
  const [modelReady, setModelReady] = useState(speciesRecognizer.isReady());
  const [photoCached, setPhotoCached] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0),
    cameraGeneration = useRef(0),
    cameraPending = useRef(false),
    needsResume = useRef(false);
  const [status, setStatus] = useState<
      "waiting" | "live" | "paused" | "failed" | "review"
    >("waiting"),
    [message, setMessage] = useState("");
  const liveCached = useLiveModelCached();
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [livePreparing, setLivePreparing] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const liveActive =
    status === "live" &&
    liveCached &&
    liveEnabled &&
    !recognizing &&
    !suspended &&
    !livePreparing;
  const live = useLiveDetection(video, liveActive, cameraZoom.digital);
  useEffect(() => {
    if (!liveActive) return;
    speciesRecognizer.unload();
  }, [liveActive]);

  useEffect(() => {
    if (suspended) return;
    let mounted = true;
    void photoModelCached().then((cached) => {
      if (mounted) setPhotoCached(cached);
    });
    return () => {
      mounted = false;
    };
  }, [suspended]);

  async function toggleLive() {
    if (liveCached && live.status !== "error") {
      setLiveEnabled(!liveEnabled);
      return;
    }
    setLivePreparing(true);
    setLiveMessage("ライブ検出モデルをダウンロードしています…");
    try {
      await downloadLiveModel();
      setLiveEnabled(true);
      setLiveMessage("");
    } catch {
      setLiveMessage(
        "ライブ検出を準備できませんでした。通信と空き容量を確認してください。",
      );
    } finally {
      setLivePreparing(false);
    }
  }
  useEffect(
    () => () => {
      generation.current++;
      cameraGeneration.current++;
      speciesRecognizer.release();
      stopCamera();
    },
    [],
  );
  function stopCamera() {
    stream.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    stream.current = null;
    setCameraTrack(undefined);
    if (video.current) video.current.srcObject = null;
  }
  async function start() {
    const request = ++cameraGeneration.current;
    cameraPending.current = true;
    setStatus("waiting");
    setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (request !== cameraGeneration.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stopCamera();
      stream.current = media;
      needsResume.current = false;
      media.getVideoTracks?.().forEach((track) => {
        track.onended = () => {
          if (request !== cameraGeneration.current) return;
          needsResume.current = true;
          setStatus("paused");
          setMessage(
            "カメラが止まりました。再開するか、下から動物を選べます。",
          );
        };
      });
      setCameraTrack(media.getVideoTracks?.()[0]);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      if (request === cameraGeneration.current) setStatus("live");
    } catch {
      if (request !== cameraGeneration.current) return;
      stopCamera();
      needsResume.current = false;
      setStatus("failed");
      setMessage(
        "カメラを使えなくても大丈夫。下から動物を選んで、同じ体験を始められます。",
      );
    } finally {
      if (request === cameraGeneration.current) cameraPending.current = false;
    }
  }
  useEffect(() => {
    if (!suspendedRef.current) void start();
    const pause = () => {
      if (stream.current || cameraPending.current || needsResume.current) {
        needsResume.current = true;
        cameraGeneration.current++;
        cameraPending.current = false;
        stopCamera();
        setStatus("paused");
        setMessage("カメラを休止しています。戻ったら再開できます。");
      }
    };
    const resume = () => {
      if (!document.hidden && !suspendedRef.current && needsResume.current) {
        needsResume.current = false;
        void start();
      }
    };
    const visibility = () => (document.hidden ? pause() : resume());
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", resume);
    };
  }, []);
  useEffect(() => {
    if (suspended && (stream.current || cameraPending.current)) {
      needsResume.current = true;
      cameraGeneration.current++;
      cameraPending.current = false;
      stopCamera();
      setStatus("paused");
    } else if (!suspended && !document.hidden && needsResume.current) {
      needsResume.current = false;
      void start();
    }
  }, [suspended]);
  function clearReview() {
    generation.current++;
    speciesRecognizer.release();
    setModelReady(speciesRecognizer.isReady());
    setRecognizing(false);
    setCandidates([]);
    setCaptured("");

    setTakenAt(undefined);
    setSelection(undefined);
    manuallySelected.current = false;
  }
  function retake() {
    clearReview();
    void start();
  }
  function chooseWithoutPhoto() {
    cameraGeneration.current++;
    cameraPending.current = false;
    needsResume.current = false;
    stopCamera();
    clearReview();
    setMessage("");
    setStatus("review");
  }
  function capture() {
    if (!video.current?.videoWidth || status !== "live") return;
    try {
      const frame = drawCameraFrame(video.current, 1200, cameraZoom.digital);
      if (!frame) throw new Error("canvas");
      const { canvas, context } = frame;
      if (frameId)
        drawPhotoFrame(context, frameId, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.8);
      clearReview();

      setCaptured(image);
      setTakenAt(new Date());
      stopCamera();
      needsResume.current = false;
      setStatus("review");
      onCapture?.();
      recordStudy(
        "animal_photographed",
        {},
        { animalId: undefined, taskId: undefined, attemptId: undefined },
      );
      void recognize(image);
    } catch {
      setMessage("撮影できませんでした。カメラをもう一度試してください。");
    }
  }
  async function recognize(image = captured) {
    const request = generation.current;
    setRecognizing(true);
    setCandidates([]);
    setMessage("初回モデルを読込中です。手動選択もできます。");
    try {
      const result = await speciesRecognizer.recognize(image, (text) => {
        if (request === generation.current) setMessage(text);
      });
      if (request !== generation.current) return;
      if (result.status === "candidates") {
        setModelReady(true);
        const [first, second] = result.candidates;
        if (
          first &&
          (result.recognition?.status === "identified" ||
            (!result.recognition && canAutoSelect(first, second))) &&
          challengeProvider.forSpecies(first.speciesId || first.groupId)
            .length > 0
        ) {
          if (!manuallySelected.current) {
            setSelection({ choice: first, method: "automatic" });
          }
          setMessage("");
          return;
        }
        setCandidates(result.candidates);
        setMessage("AIの候補です。実物と写真を見て確定してください。");
      } else if (result.status !== "ready") setMessage(result.reason);
    } finally {
      if (request === generation.current) {
        setRecognizing(false);
        setModelReady(speciesRecognizer.isReady());
      }
    }
  }
  async function prepare() {
    const request = generation.current;
    setRecognizing(true);
    setMessage("モデルを準備しています…");
    const result = await speciesRecognizer.prepare((text) => {
      if (request === generation.current) setMessage(text);
    });
    if (request !== generation.current) return;
    setModelReady(result.status === "ready");
    setMessage(
      result.status === "ready"
        ? "準備できました。撮影するとAIが推定します。違うときは選び直せます。"
        : result.status === "unavailable" || result.status === "unknown"
          ? result.reason
          : "準備を確認してください。",
    );
    setRecognizing(false);
  }
  const selectedTask = selection
    ? challengeProvider.forSpecies(
        selection.choice.speciesId ?? selection.choice.groupId,
      )[0]
    : undefined;

  return (
    <div className="camera-page design3-camera">
      <section hidden={status === "review"}>
        <h1 className="sr-only">動物を撮影しよう</h1>
        <div className="camera-pitsune">
          <img
            alt=""
            className="camera-pitsune-face"
            src={assetPath("figma/entry/camera-face.svg")}
          />
          <p className="pitsune-bubble">
            <img
              className="camera-prompt-art"
              src={assetPath("illustrations/pdf-design/camera-prompt.svg")}
              alt="動物の写真を撮ろう！"
            />
          </p>
        </div>
        <div className="camera-frame">
          <video
            ref={video}
            playsInline
            autoPlay
            muted
            aria-label="動物を映すカメラ"
            className={status === "live" ? "" : "hidden-video"}
            style={{ transform: `scale(${cameraZoom.digital})` }}
          />
          {status !== "live" && (
            <div className="camera-fallback">
              {status === "failed" ? (
                <CameraOff size={107} strokeWidth={1.35} aria-hidden="true" />
              ) : (
                <img
                  className="camera-placeholder-art"
                  src={assetPath(
                    "illustrations/pdf-design/camera-placeholder.svg",
                  )}
                  alt=""
                />
              )}
              <span role="status">
                {status === "paused"
                  ? "カメラを再開できます"
                  : status === "waiting"
                    ? "カメラを準備しています"
                    : "手動で始められるよ"}
              </span>
            </div>
          )}
          {status === "live" && frameId && (
            <svg
              className="photo-frame-overlay"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: frameSvg(frameId) }}
            />
          )}
          {dopa && status === "live" && (
            <div
              className="photo-frame-picker"
              role="group"
              aria-label="変身フォトフレーム"
            >
              <button
                type="button"
                aria-pressed={frameId === ""}
                className={frameId === "" ? "is-active" : ""}
                onClick={() => setFrameId("")}
              >
                フレームなし
              </button>
              {PHOTO_FRAMES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={frameId === f.id}
                  className={frameId === f.id ? "is-active" : ""}
                  onClick={() => setFrameId(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {liveActive && live.boxes.length > 0 && (
            <div className="live-animal-overlay" aria-label="ライブ検出の候補">
              {live.boxes.map(({ label, left, top, right, bottom }, index) => (
                <div
                  key={index}
                  className="live-animal-box"
                  data-align-end={left > 0.62}
                  style={{
                    left: left * 100 + "%",
                    top: top * 100 + "%",
                    width: (right - left) * 100 + "%",
                    height: (bottom - top) * 100 + "%",
                  }}
                >
                  <span>{label}の候補</span>
                </div>
              ))}
            </div>
          )}
          <CameraZoom {...cameraZoom} />
          {status === "live" && <span className="sr-only">カメラで観察中</span>}
        </div>
        <div className="camera-controls">
          <button
            type="button"
            className="camera-side-button"
            aria-label="ギャラリー"
            disabled={tutorial}
            onClick={() => onCollection?.()}
          >
            <img
              alt=""
              className="camera-side-icon camera-gallery-icon"
              src={assetPath("illustrations/pdf-design/camera-gallery.svg")}
            />
            <img
              alt=""
              className="camera-side-label"
              src={assetPath(
                "illustrations/pdf-design/camera-gallery-label.svg",
              )}
            />
          </button>
          <CameraShutter
            disabled={status !== "live" || recognizing || cameraZoom.busy}
            onClick={capture}
          />
          <button
            type="button"
            className="camera-side-button"
            aria-label="マイページ"
            onClick={(event) => onSettings?.(event.currentTarget)}
          >
            <img
              alt=""
              className="camera-side-icon"
              src={assetPath("illustrations/pdf-design/camera-profile.svg")}
            />
            <img
              alt=""
              className="camera-side-label"
              src={assetPath(
                "illustrations/pdf-design/camera-profile-label.svg",
              )}
            />
          </button>
        </div>
        {status !== "review" && message && (
          <p className="camera-message" role="status">
            {message}
            {(status === "failed" || status === "paused") && (
              <button className="text-button" onClick={() => void start()}>
                {status === "paused"
                  ? "カメラを再開する"
                  : "カメラをもう一度試す"}
              </button>
            )}
          </p>
        )}
        {status === "live" && (
          <div className="live-camera-control">
            <button
              type="button"
              className="text-button"
              aria-pressed={liveCached ? liveEnabled : undefined}
              disabled={livePreparing}
              onClick={() => void toggleLive()}
            >
              {live.status === "error"
                ? "ライブ検出を再準備"
                : liveCached
                  ? `ライブ検出 ${liveEnabled ? "ON" : "OFF"}`
                  : "ライブ検出を準備（約3.7 MB）"}
            </button>
            {liveMessage && <p role="status">{liveMessage}</p>}
            {liveActive && live.status === "starting" && (
              <p role="status">ライブ検出を起動しています…</p>
            )}
            {liveActive && live.status === "error" && (
              <p role="status">
                ライブ検出を開けませんでした。モデルを再準備できます。
              </p>
            )}
          </div>
        )}
        <div className="design3-camera-alternatives">
          <button className="text-button" onClick={chooseWithoutPhoto}>
            写真なしで始める
          </button>
          <button className="text-button" onClick={onFreeDraw}>
            自由に描く
          </button>
        </div>
      </section>
      {status === "review" && (
        <div inert={celebrating || undefined}>
          <PhotoReview
            dopa={dopa}
            photo={captured}
            takenAt={takenAt}
            selection={selection?.choice}
            recognized={selection?.method === "automatic"}
            candidates={candidates}
            onChange={(choice) => {
              manuallySelected.current = true;
              setSelection({ choice, method: "manual" });
            }}
            onRetake={retake}
            onConfirm={() => {
              if (selectedTask && selection)
                onSelect(captured, selectedTask.id, selection.method);
            }}
          />
          {message && (
            <p className="quiet-note" role="status">
              {message}
            </p>
          )}
        </div>
      )}
      {celebrating && <PhotoCelebration taskId={selectedTask?.id} />}
      <details className="recognition-settings" hidden={celebrating}>
        <summary>撮影の設定</summary>
        {status !== "review" ? (
          <>
            <button
              className="text-button"
              disabled={recognizing || modelReady || photoCached}
              onClick={() => void prepare()}
            >
              {modelReady || photoCached
                ? "識別モデル準備済み"
                : "識別モデルを先にダウンロード"}
            </button>
            <p className="quiet-note">
              初回は約150MB以上。Wi-Fiで先に準備できます。
            </p>
          </>
        ) : (
          captured && (
            <button
              className="text-button"
              disabled={recognizing}
              onClick={() => void recognize()}
            >
              {recognizing ? "候補を探しています…" : "AIで候補を探す"}
            </button>
          )
        )}
        {recognizing && (
          <button
            className="text-button"
            onClick={() => {
              speciesRecognizer.cancel();
              setModelReady(false);
            }}
          >
            {captured ? "検索をやめる" : "準備をやめる"}
          </button>
        )}
      </details>
    </div>
  );
}
