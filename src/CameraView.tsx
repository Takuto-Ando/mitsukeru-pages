import { challengeProvider } from "./domain";
import { recordStudy } from "./research/study";
import { groups } from "./content/groups";
import type { Candidate } from "./recognition/labels";
import { PhotoReview } from "./components/PhotoReview";
import { PhotoCelebration } from "./components/ChallengeIntro";
import { Pitsune } from "./components/Pitsune";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Images, UserRound } from "lucide-react";
import { speciesRecognizer } from "./recognition/species";

type ZoomCapabilities = MediaTrackCapabilities & {
  zoom?: { min: number; max: number };
};

async function applyZoom(track: MediaStreamTrack | undefined, zoom: number) {
  try {
    const capabilities: ZoomCapabilities | undefined =
      track?.getCapabilities?.();
    const range = capabilities?.zoom;
    if (track && range && zoom >= range.min && zoom <= range.max) {
      const setting: MediaTrackConstraintSet & { zoom: number } = { zoom };
      await track.applyConstraints({ advanced: [setting] });
    }
  } catch {
    // Some cameras expose a zoom range but reject external changes.
  }
}
export function CameraView({
  onSelect,
  onCollection,
  onSettings,
  suspended = false,
  celebrating = false,
  onFreeDraw,
}: {
  suspended?: boolean;
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
  const [detected, setDetected] = useState("");
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [captured, setCaptured] = useState("");
  const [modelReady, setModelReady] = useState(speciesRecognizer.isReady());
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
      void applyZoom(media.getVideoTracks?.()[0], zoomRef.current);
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
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        1200 / Math.max(video.current.videoWidth, video.current.videoHeight),
      );
      canvas.width = Math.round(video.current.videoWidth * scale);
      canvas.height = Math.round(video.current.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.8);
      clearReview();
      setDetected("");
      setCaptured(image);
      setTakenAt(new Date());
      stopCamera();
      needsResume.current = false;
      setStatus("review");
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
          first.score >= 0.55 &&
          first.score - (second?.score ?? 0) >= 0.12 &&
          challengeProvider.forSpecies(first.speciesId || first.groupId)
            .length > 0
        ) {
          if (!manuallySelected.current) {
            setSelection({ choice: first, method: "automatic" });
            setDetected(
              first.speciesId === "sheep"
                ? "ヒツジ"
                : (groups.find((item) => item.id === first.groupId)?.name ??
                    ""),
            );
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
          <Pitsune pose="face" className="camera-pitsune-face" />
          <p className="pitsune-bubble">
            {detected ? (
              <>
                <strong>{detected}</strong>がいるよ！
              </>
            ) : (
              <>
                <strong>動物の写真</strong>を撮ろう！
              </>
            )}
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
          />
          {status !== "live" && (
            <div className="camera-fallback">
              {status === "failed" ? (
                <CameraOff size={107} strokeWidth={1.35} aria-hidden="true" />
              ) : (
                <Camera size={107} strokeWidth={1.35} aria-hidden="true" />
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
          {status === "live" && detected && (
            <div className="vf-corners" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          <div
            className="design3-zoom"
            role="group"
            aria-label="カメラのズーム"
          >
            {[0.5, 1].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={zoom === value}
                onClick={() => {
                  setZoom(value);
                  void applyZoom(stream.current?.getVideoTracks?.()[0], value);
                }}
              >
                {value}×
              </button>
            ))}
          </div>
          {status === "live" && <span className="sr-only">カメラで観察中</span>}
        </div>
        <div className="camera-controls">
          <button
            type="button"
            className="camera-side-button"
            onClick={() => onCollection?.()}
          >
            <Images size={29} aria-hidden="true" />
            ギャラリー
          </button>
          <button
            className="shutter-button"
            aria-label="シャッター"
            disabled={status !== "live" || recognizing}
            onClick={capture}
          />
          <button
            type="button"
            className="camera-side-button"
            onClick={(event) => onSettings?.(event.currentTarget)}
          >
            <UserRound size={29} aria-hidden="true" />
            マイページ
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
            photo={captured}
            takenAt={takenAt}
            selection={selection?.choice}
            candidates={candidates}
            onChange={(choice) => {
              manuallySelected.current = true;
              setSelection({ choice, method: "manual" });
              setDetected(
                choice.speciesId === "sheep"
                  ? "ヒツジ"
                  : (groups.find((item) => item.id === choice.groupId)?.name ??
                      ""),
              );
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
      {celebrating && <PhotoCelebration />}
      <details className="recognition-settings" hidden={celebrating}>
        <summary>撮影の設定</summary>
        {status !== "review" ? (
          <>
            <button
              className="text-button"
              disabled={recognizing || modelReady}
              onClick={() => void prepare()}
            >
              {modelReady
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
