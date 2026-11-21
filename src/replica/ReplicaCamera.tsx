import { downloadLiveModel, liveModelCached } from "../recognition/liveModel";
import { useModelPreload } from "../recognition/useModelPreload";
import { usePhotoModelDownloading } from "../recognition/usePhotoIdentification";
import { LiveAnimalOverlay } from "../components/LiveAnimalOverlay";
import {
  useLiveDetection,
  useLiveModelCached,
} from "../recognition/useLiveDetection";
import { CardLettering } from "../components/CardLettering";
import { useEffect, useRef, useState } from "react";
import { BubbleLine } from "../components/BubbleLine";
import { assetPath } from "../content/artwork";
import { CameraShutter, CameraZoom } from "../components/CameraControls";
import { drawCameraFrame, useCameraZoom } from "../camera/zoom";

export const samplePhoto = () =>
  assetPath("replica-assets/giraffe-example.png");

const liveSetting = "zooketch-live-detection-v1";
const photoRatio = [4, 5] as const;

const recognizedAnimals = new Map([
  ["キリン", { groupId: "giraffe" }],
  ["シマウマ", { groupId: "zebra" }],
  ["ゾウ", { groupId: "elephant" }],
  ["クマ", { groupId: "bear" }],
  ["ヒツジ", { groupId: "goat", taskId: "sheep" }],
]);

export type CameraCapture = {
  photo?: string;
  sample: boolean;
  animal?: { groupId: string; name: string; taskId?: string };
};

export function ReplicaCamera({
  tutorial,
  legacy = false,
  framedExample,
  onCapture,
  onGallery,
  onHome,
  onFreeDraw,
  onSettings,
  suspended = false,
}: {
  tutorial: boolean;
  legacy?: boolean;
  framedExample: boolean;
  onCapture: (capture: CameraCapture) => void;
  onGallery: () => void;
  onHome: () => void;
  onFreeDraw: () => void;
  onSettings?: (trigger: HTMLButtonElement) => void;
  suspended?: boolean;
}) {
  useModelPreload({ enabled: legacy, allowMetered: true });
  const photoModelDownloading = usePhotoModelDownloading();
  const [sample, setSample] = useState((legacy && tutorial) || framedExample);
  const [sampleHasAnimal, setSampleHasAnimal] = useState(framedExample);
  const [sampleReady, setSampleReady] = useState(false);
  const [sampleUnavailable, setSampleUnavailable] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack>();
  const cameraZoom = useCameraZoom(cameraTrack, sample);
  const [message, setMessage] = useState("");
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestNumber, retryCamera] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const video = useRef<HTMLVideoElement>(null);
  const liveCached = useLiveModelCached();
  const [liveEnabled, setLiveEnabled] = useState(() => {
    if (!legacy) return true;
    try {
      return localStorage.getItem(liveSetting) !== "0";
    } catch {
      return true;
    }
  });
  const [livePreparing, setLivePreparing] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);
  const [liveRetry, setLiveRetry] = useState(0);
  const liveActive =
    !sample &&
    streamReady &&
    visible &&
    !menuOpen &&
    !suspended &&
    liveCached &&
    liveEnabled;
  const live = useLiveDetection(
    video,
    liveActive,
    cameraZoom.digital,
    liveRetry,
  );
  const liveError = (!liveCached && liveFailed) || live.status === "error";
  const realCamera = !sample && visible;
  const example = useRef<HTMLImageElement>(null);
  const sampleVisible = sampleHasAnimal || (legacy && cameraZoom.zoom === 0.5);
  const bestMatch =
    !legacy && liveActive
      ? live.boxes.find(({ label }) => recognizedAnimals.has(label))
      : undefined;
  const selection = bestMatch && recognizedAnimals.get(bestMatch.label);
  const animal =
    bestMatch && selection
      ? { ...selection, name: bestMatch.label }
      : undefined;
  const recognized = sample
    ? sampleVisible
    : legacy
      ? liveActive && live.boxes.length > 0
      : !!animal;
  const figmaNode = tutorial
    ? recognized
      ? "43-1745"
      : "43-1681"
    : recognized
      ? "43-1494"
      : "38-1026";
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!realCamera || liveCached || !liveEnabled) return;
    let active = true;
    let pending = false;
    let attempt = 0;
    let timer = 0;
    const prepare = async () => {
      if (!active || pending || !navigator.onLine) return;
      pending = true;
      try {
        if ((await liveModelCached()) || !active) return;
        setLiveFailed(false);
        setLivePreparing(true);
        await downloadLiveModel();
      } catch {
        if (active) {
          setLiveFailed(true);
          // Brief interruptions retry automatically without adding camera controls.
          if (!legacy && attempt < 2)
            timer = window.setTimeout(prepare, ++attempt * 1200);
        }
      } finally {
        pending = false;
        if (active) setLivePreparing(false);
      }
    };
    const networkReturned = () => {
      window.clearTimeout(timer);
      attempt = 0;
      void prepare();
    };
    void prepare();
    window.addEventListener("online", networkReturned);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("online", networkReturned);
    };
  }, [legacy, liveCached, liveEnabled, liveRetry, realCamera]);

  const retriedWorker = useRef(false);
  useEffect(() => {
    if (!liveActive) retriedWorker.current = false;
    if (
      legacy ||
      !liveActive ||
      live.status !== "error" ||
      retriedWorker.current
    )
      return;
    const retry = window.setTimeout(() => {
      retriedWorker.current = true;
      setLiveRetry((attempt) => attempt + 1);
    }, 1500);
    return () => window.clearTimeout(retry);
  }, [legacy, live.status, liveActive]);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (sample || menuOpen || suspended || !visible) return;
    let active = true;
    const element = video.current;
    function stopCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = undefined;
      setCameraTrack(undefined);
      if (element) element.srcObject = null;
      setStreamReady(false);
    }
    function cameraFailed(message: string) {
      if (tutorial && !legacy) {
        setSample(true);
      } else {
        setCameraUnavailable(true);
      }
      setMessage(message);
    }

    async function startCamera() {
      setCameraUnavailable(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        cameraFailed("この端末ではカメラを開けません。");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active || document.hidden || !element) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setCameraTrack(stream.getVideoTracks?.()[0]);
        element.srcObject = stream;
        await element.play();
        if (active) {
          setStreamReady(Boolean(element.videoWidth));
          setMessage("");
        }
      } catch {
        if (!active) return;
        stopCamera();
        cameraFailed("カメラを開けませんでした。");
      }
    }
    void startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [legacy, menuOpen, requestNumber, sample, suspended, tutorial, visible]);

  useEffect(() => {
    if (menuOpen) menu.current?.showModal();
  }, [menuOpen]);

  function chooseMode(nextSample: boolean) {
    if (nextSample !== sample) {
      setSampleReady(false);
      setSampleUnavailable(false);
    }
    setSample(nextSample);
    setCameraUnavailable(false);
    setSampleHasAnimal(false);
    setMessage("");
    setMenuOpen(false);
  }

  function toggleLive() {
    if (liveError || (liveEnabled && !liveCached)) {
      setLiveFailed(false);
      setLiveRetry((attempt) => attempt + 1);
    } else {
      setLiveEnabled(!liveEnabled);
      try {
        localStorage.setItem(liveSetting, liveEnabled ? "0" : "1");
      } catch {
        // The switch still works for this camera when storage is unavailable.
      }
    }
  }

  function takePhoto() {
    if (sample && !sampleVisible) {
      setSampleHasAnimal(true);
      return;
    }
    if (!legacy && cameraUnavailable) {
      onCapture({ sample: false });
      return;
    }

    if (!legacy && sample && sampleUnavailable) {
      onCapture({ sample: true });
      return;
    }

    if (legacy && sample && cameraZoom.digital === 1) {
      onCapture({ photo: samplePhoto(), sample: true });
      return;
    }

    const frame = sample ? example.current : video.current;
    const ratio = legacy ? undefined : photoRatio;
    try {
      const shot =
        frame && drawCameraFrame(frame, 1000, cameraZoom.digital, ratio);
      if (shot) {
        onCapture({
          photo: shot.canvas.toDataURL("image/jpeg", 0.82),
          sample,
          animal,
        });
      } else if (legacy && sample) {
        onCapture({ photo: samplePhoto(), sample: true });
      }
    } catch {
      setMessage("撮影できませんでした。もう一度試してね。");
    }
  }

  const art = "illustrations/pdf-design/";
  return (
    <section
      className="camera-page design3-camera replica-camera"
      data-figma-node={figmaNode}
    >
      <h1 className="sr-only">動物を撮影しよう</h1>
      <div className="camera-pitsune">
        <img
          alt=""
          className="camera-pitsune-face"
          src={assetPath("figma/entry/camera-face.svg")}
        />
        <p className="pitsune-bubble">
          {sample && sampleVisible ? (
            <CardLettering
              className="camera-prompt-art replica-found-art"
              src={assetPath("replica-assets/camera-found.svg")}
              text="キリンがいるよ！"
            />
          ) : animal ? (
            <BubbleLine text={`${animal.name}がいるよ！`} />
          ) : (
            <CardLettering
              className="camera-prompt-art"
              src={assetPath(art + "camera-prompt.svg")}
              text="動物の写真を撮ろう！"
            />
          )}
        </p>
      </div>
      <div className="camera-frame">
        {sample ? (
          <>
            <img
              className="replica-camera-sample"
              data-framed={sampleVisible}
              ref={example}
              style={{ transform: `scale(${cameraZoom.digital})` }}
              src={samplePhoto()}
              onLoad={({ currentTarget: image }) => {
                void image.decode().then(
                  () => {
                    if (example.current === image) setSampleReady(true);
                  },
                  () => {
                    if (example.current === image) setSampleUnavailable(true);
                  },
                );
              }}
              onError={() => setSampleUnavailable(true)}
              alt={
                sampleVisible
                  ? "見本写真のキリン"
                  : "キリンの見本写真を拡大した背景"
              }
            />
            <span className="replica-sample-label">見本写真</span>
          </>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              autoPlay
              muted
              aria-label="動物を映すカメラ"
              style={{ transform: `scale(${cameraZoom.digital})` }}
              onLoadedData={() =>
                setStreamReady(Boolean(video.current?.videoWidth))
              }
            />
            {!streamReady && (
              <div className="camera-fallback">
                <img
                  className="camera-placeholder-art"
                  alt=""
                  src={assetPath(art + "camera-placeholder.svg")}
                />
                <span role="status">
                  {message || "カメラを準備しています。"}
                  {!legacy && cameraUnavailable && (
                    <> シャッターで動物を選べます。</>
                  )}
                </span>
              </div>
            )}
          </>
        )}
        {((sample && sampleVisible) || !!animal) && (
          <img
            alt=""
            className="design3-camera-guides"
            src={assetPath("figma/entry/camera-guides.svg")}
            style={
              !tutorial && animal ? { top: "6.16%", left: "7.71%" } : undefined
            }
          />
        )}
        {legacy && liveActive && <LiveAnimalOverlay boxes={live.boxes} />}
        {legacy && ((!sample && !message) || photoModelDownloading) && (
          <div className="live-camera-control">
            {!sample && !message && (
              <button
                type="button"
                className="text-button"
                aria-pressed={liveError ? undefined : liveEnabled}
                onClick={toggleLive}
                disabled={livePreparing && !liveCached}
              >
                {liveError
                  ? "ライブ検出を再準備"
                  : livePreparing && !liveCached
                    ? "ライブ検出モデルをダウンロード中…"
                    : liveCached || !liveEnabled
                      ? `ライブ検出 ${liveEnabled ? "ON" : "OFF"}`
                      : "ライブ検出を準備"}
              </button>
            )}
            {photoModelDownloading && (
              <p role="status">画像認識モデルをダウンロード中…</p>
            )}
          </div>
        )}
        {!legacy && !sample && livePreparing && (
          <p className="replica-camera-model-status" role="status">
            画像認識モデルをダウンロード中…
          </p>
        )}
        <CameraZoom {...cameraZoom} />
      </div>
      <div className="camera-controls">
        <button
          type="button"
          className="camera-side-button"
          aria-label="ギャラリー"
          onClick={onGallery}
          disabled={tutorial}
        >
          <img
            alt=""
            className="camera-side-icon camera-gallery-icon"
            src={assetPath(art + "camera-gallery.svg")}
          />
          <span className="camera-side-label">ギャラリー</span>
        </button>
        <CameraShutter
          disabled={
            (!sample && !streamReady && (legacy || !cameraUnavailable)) ||
            (!legacy &&
              sample &&
              sampleVisible &&
              !sampleReady &&
              !sampleUnavailable) ||
            cameraZoom.busy
          }
          onClick={takePhoto}
        />
        <button
          type="button"
          className="camera-side-button"
          aria-label="マイページ"
          onClick={(event) => {
            if (onSettings) onSettings(event.currentTarget);
            else setMenuOpen(true);
          }}
          disabled={tutorial}
        >
          <img
            alt=""
            className="camera-side-icon"
            src={assetPath(art + "camera-profile.svg")}
          />
          <span className="camera-side-label">マイページ</span>
        </button>
      </div>
      {legacy && !sample && message && (
        <div className="replica-camera-alternatives">
          <button
            className="text-button"
            onClick={() => {
              setMessage("");
              retryCamera((number) => number + 1);
            }}
          >
            カメラをもう一度開く
          </button>
          <button className="text-button" onClick={() => chooseMode(true)}>
            見本写真で体験
          </button>
          <button
            className="text-button"
            onClick={() => onCapture({ sample: false })}
          >
            写真なしで動物を選ぶ
          </button>
        </div>
      )}
      {menuOpen && (
        <dialog
          ref={menu}
          className="replica-menu"
          aria-labelledby="replica-menu-title"
          onClose={() => setMenuOpen(false)}
        >
          <h2 id="replica-menu-title">マイページ</h2>
          {sample ? (
            <button className="design3-pill" onClick={() => chooseMode(false)}>
              カメラを使う
            </button>
          ) : (
            <button className="design3-pill" onClick={() => chooseMode(true)}>
              見本写真で体験
            </button>
          )}
          <button className="text-button" onClick={onFreeDraw}>
            自由にスケッチ
          </button>
          <button className="text-button" onClick={onHome}>
            タイトルに戻る
          </button>
          <button className="text-button" onClick={() => menu.current?.close()}>
            閉じる
          </button>
        </dialog>
      )}
    </section>
  );
}
