import { downloadLiveModel, liveModelCached } from "../recognition/liveModel";
import { useModelPreload } from "../recognition/useModelPreload";
import { usePhotoModelDownloading } from "../recognition/usePhotoIdentification";
import {
  liveDetectorHint,
  useLiveSpecies,
} from "../recognition/useLiveSpecies";
import { LiveAnimalOverlay } from "../components/LiveAnimalOverlay";
import {
  useLiveDetection,
  useLiveModelCached,
} from "../recognition/useLiveDetection";
import { CardLettering } from "../components/CardLettering";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BubbleLine } from "../components/BubbleLine";
import { assetPath } from "../content/artwork";
import { CameraShutter, CameraZoom } from "../components/CameraControls";
import {
  cameraPhotoRatio,
  drawCameraFrame,
  drawPhotoRecognitionFrames,
  useCameraZoom,
} from "../camera/zoom";
import {
  cameraFailure,
  openPreferredCamera,
  type CameraFailure,
} from "../camera/media";
import {
  cameraPermissionSettings,
  cameraSettingsReturnedEvent,
  openCameraPermissionSettings,
} from "../camera/permission";
import {
  photoFromCanvas,
  photoViewQuality,
  type PhotoSource,
} from "../recognition/speciesViews";
import { CameraModelDownload } from "./TutorialModelDownload";
import "./camera-tracking.css";

export const samplePhoto = () =>
  assetPath("replica-assets/giraffe-example.png");

const liveSetting = "zooketch-live-detection-v1";

export type CameraCapture = {
  photo?: string;
  recognitionInput?: { full?: string; crop?: string; tiles?: PhotoSource[] };
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
  useModelPreload({ enabled: legacy });
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
  const lastFailure = useRef<CameraFailure | undefined>(undefined);
  const returningFromSettings = useRef(false);
  const fallbackSample = useRef(false);
  const captureStarted = useRef(false);
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
  const [offerLiveRetry, setOfferLiveRetry] = useState(false);
  const [liveRetry, setLiveRetry] = useState(0);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const retryingLive = useRef(false);
  const retriedWorker = useRef(false);
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
  const liveDownloadFailed =
    offerLiveRetry || (live.status === "error" && retriedWorker.current);
  const liveDownloading = livePreparing || refreshingLive;
  const realCamera = !sample && visible;
  const example = useRef<HTMLImageElement>(null);
  const [trackedAnimalId, setTrackedAnimalId] = useState<number>();
  const sampleVisible = sampleHasAnimal || (legacy && cameraZoom.zoom === 0.5);
  const bestMatch =
    !legacy && liveActive
      ? (live.boxes.find(({ id }) => id === trackedAnimalId) ?? live.boxes[0])
      : undefined;
  const species = useLiveSpecies(
    video,
    !legacy &&
      !sample &&
      visible &&
      !menuOpen &&
      !suspended &&
      !cameraUnavailable,
    streamReady,
    cameraZoom.digital,
    bestMatch,
  );
  const speciesNeedsRetry =
    species.modelStatus === "deferred" || species.modelStatus === "failed";
  const canRetryModels =
    !liveDownloading &&
    !photoModelDownloading &&
    (liveDownloadFailed || speciesNeedsRetry);
  const animal = species.animal;
  const candidate = animal
    ? undefined
    : (species.candidate ??
      (species.modelStatus === "ready" && (bestMatch?.score ?? 0) < 0.8
        ? undefined
        : liveDetectorHint(bestMatch)));
  const recognized = sample
    ? sampleVisible
    : legacy
      ? liveActive && live.boxes.length > 0
      : !!(animal || candidate);
  const figmaNode = tutorial
    ? recognized
      ? "43-1745"
      : "43-1681"
    : recognized
      ? "43-1494"
      : "38-1026";
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const stopCaptureStream = useRef<(() => void) | undefined>(undefined);
  const menu = useRef<HTMLDialogElement>(null);
  const bestMatchId = bestMatch?.id;

  useEffect(() => {
    setTrackedAnimalId(bestMatchId);
  }, [bestMatchId]);

  useEffect(() => {
    if (!realCamera || liveCached || !liveEnabled) return;
    let active = true;
    let pending = false;
    let attempt = 0;
    let timer = 0;
    const prepare = async () => {
      if (!active || pending) return;
      if (!navigator.onLine) {
        if (!legacy) setOfferLiveRetry(true);
        return;
      }
      pending = true;
      try {
        if ((await liveModelCached()) || !active) return;
        setLiveFailed(false);
        setOfferLiveRetry(false);
        setLivePreparing(true);
        await downloadLiveModel();
      } catch {
        if (active) {
          setLiveFailed(true);
          // Brief interruptions retry automatically without adding camera controls.
          if (!legacy && attempt < 2)
            timer = window.setTimeout(prepare, ++attempt * 1200);
          else if (!legacy) setOfferLiveRetry(true);
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
    const hide = () => setVisible(false);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  const retryUnavailableCamera = useCallback(() => {
    if (document.hidden || !lastFailure.current) return;
    lastFailure.current = undefined;
    if (fallbackSample.current) {
      fallbackSample.current = false;
      setSample(false);
      setSampleHasAnimal(false);
      setSampleReady(false);
      setSampleUnavailable(false);
    }
    setMessage("");
    retryCamera((number) => number + 1);
  }, []);

  const cameraSettings =
    message && lastFailure.current === "permission"
      ? cameraPermissionSettings()
      : undefined;

  async function openDeviceSettings() {
    returningFromSettings.current = true;
    if (!(await openCameraPermissionSettings())) {
      returningFromSettings.current = false;
      setMessage("設定を開けませんでした。");
    }
  }

  useEffect(() => {
    if (menuOpen || suspended) return;
    let active = true;
    let permission: PermissionStatus | undefined;
    function retry() {
      if (active) retryUnavailableCamera();
    }
    const permissionChanged = () => {
      if (permission?.state === "granted") retry();
    };
    const settingsReturned = () => {
      if (document.hidden || !returningFromSettings.current) return;
      returningFromSettings.current = false;
      retry();
    };
    const focused = () => {
      if (returningFromSettings.current) {
        settingsReturned();
        return;
      }
      const reason = lastFailure.current;
      if (
        reason === "busy" ||
        reason === "unavailable" ||
        (reason === "permission" && permission?.state !== "denied")
      )
        retry();
    };
    window.addEventListener("focus", focused);
    window.addEventListener(cameraSettingsReturnedEvent, settingsReturned);
    document.addEventListener("visibilitychange", settingsReturned);
    void navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((status) => {
        if (!active) return;
        permission = status;
        status.addEventListener?.("change", permissionChanged);
      })
      .catch(() => {
        // Some Safari versions do not expose camera through Permissions.
        // Focus and visibility recovery still work in that case.
      });
    return () => {
      active = false;
      permission?.removeEventListener?.("change", permissionChanged);
      window.removeEventListener("focus", focused);
      window.removeEventListener(cameraSettingsReturnedEvent, settingsReturned);
      document.removeEventListener("visibilitychange", settingsReturned);
    };
  }, [menuOpen, retryUnavailableCamera, suspended]);

  useEffect(() => {
    if (sample || menuOpen || suspended || !visible) return;
    let active = true;
    const element = video.current;
    let track: MediaStreamTrack | undefined;
    function stopCamera() {
      track?.removeEventListener?.("ended", interrupted);
      track = undefined;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = undefined;
      setCameraTrack(undefined);
      if (element) element.srcObject = null;
      setStreamReady(false);
    }
    function cameraFailed(reason: CameraFailure, nextMessage: string) {
      lastFailure.current = reason;
      if (tutorial && !legacy) {
        fallbackSample.current = true;
        setSample(true);
      } else {
        setCameraUnavailable(true);
      }
      setMessage(nextMessage);
    }
    function interrupted() {
      if (!active) return;
      stopCamera();
      cameraFailed("busy", "カメラを開けませんでした。");
    }
    function hidePage() {
      active = false;
      stopCamera();
    }
    function visibilityChanged() {
      if (document.hidden) hidePage();
    }

    async function startCamera() {
      setCameraUnavailable(false);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        cameraFailed(
          window.isSecureContext ? "unavailable" : "insecure",
          "この端末ではカメラを開けません。",
        );
        return;
      }
      try {
        const stream = await openPreferredCamera(
          navigator.mediaDevices,
          () => active && !document.hidden,
        );
        if (!active || document.hidden || !element) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        track = stream.getVideoTracks?.()[0];
        track?.addEventListener?.("ended", interrupted, { once: true });
        setCameraTrack(track);
        element.srcObject = stream;
        await element.play();
        if (active && streamRef.current === stream) {
          lastFailure.current = undefined;
          setStreamReady(Boolean(element.videoWidth));
          setMessage("");
        }
      } catch (error) {
        if (!active) return;
        stopCamera();
        const reason = cameraFailure(error);
        cameraFailed(
          reason,
          reason === "unavailable" || reason === "insecure"
            ? "この端末ではカメラを開けません。"
            : "カメラを開けませんでした。",
        );
      }
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", hidePage);
    stopCaptureStream.current = hidePage;
    void startCamera();
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", hidePage);
      stopCaptureStream.current = undefined;
      hidePage();
    };
  }, [legacy, menuOpen, requestNumber, sample, suspended, tutorial, visible]);

  useEffect(() => {
    if (menuOpen) menu.current?.showModal();
  }, [menuOpen]);

  function chooseMode(nextSample: boolean) {
    fallbackSample.current = false;
    lastFailure.current = undefined;
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
      setOfferLiveRetry(false);
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

  async function retryLiveModel() {
    if (retryingLive.current) return;
    retryingLive.current = true;
    setOfferLiveRetry(false);
    try {
      if (!(await liveModelCached())) {
        setRefreshingLive(true);
        await downloadLiveModel();
      }
      retriedWorker.current = false;
      setLiveRetry((attempt) => attempt + 1);
    } catch {
      setOfferLiveRetry(true);
    } finally {
      retryingLive.current = false;
      setRefreshingLive(false);
    }
  }

  function retryModels() {
    if (!canRetryModels) return;
    if (liveDownloadFailed) void retryLiveModel();
    if (speciesNeedsRetry) species.prepareManually.current();
  }

  function submitCapture(capture: CameraCapture) {
    if (captureStarted.current) return;
    captureStarted.current = true;
    try {
      species.stop.current();
      onCapture(capture);
      stopCaptureStream.current?.();
    } catch (error) {
      captureStarted.current = false;
      throw error;
    }
  }

  function takePhoto() {
    if (captureStarted.current) return;
    if (sample && !sampleVisible) {
      setSampleHasAnimal(true);
      return;
    }
    if (!legacy && cameraUnavailable) {
      submitCapture({ sample: false });
      return;
    }

    if (!legacy && sample && sampleUnavailable) {
      submitCapture({ sample: true });
      return;
    }

    if (legacy && sample && cameraZoom.digital === 1) {
      submitCapture({ photo: samplePhoto(), sample: true });
      return;
    }

    const frame = sample ? example.current : video.current;
    const ratio = legacy ? undefined : cameraPhotoRatio;
    try {
      const shot =
        frame && drawCameraFrame(frame, 1000, cameraZoom.digital, ratio);
      if (shot) {
        const photo = shot.canvas.toDataURL("image/jpeg", 0.82);
        let recognitionInput: CameraCapture["recognitionInput"];
        if (!legacy && !sample && video.current) {
          try {
            const frames = drawPhotoRecognitionFrames(
              video.current,
              cameraZoom.digital,
              bestMatch,
              shot.canvas,
            );
            if (frames)
              recognitionInput = {
                full: frames.full.toDataURL(
                  "image/jpeg",
                  photoViewQuality.full,
                ),
                crop: frames.crop?.toDataURL(
                  "image/jpeg",
                  photoViewQuality.crop,
                ),
                tiles: frames.tiles.map((tile) =>
                  photoFromCanvas(tile, photoViewQuality.crop),
                ),
              };
          } catch {
            // The full photo is still available for recognition.
          }
        }
        submitCapture({ photo, sample, animal, recognitionInput });
      } else if (legacy && sample) {
        submitCapture({ photo: samplePhoto(), sample: true });
      } else {
        setMessage("撮影できませんでした。もう一度試してね。");
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
          className={
            legacy
              ? "camera-pitsune-face"
              : "camera-pitsune-face camera-pitsune-binoculars"
          }
          src={assetPath(
            legacy
              ? "figma/entry/camera-face.svg"
              : "replica-assets/camera-binoculars.svg",
          )}
        />
        <p className="pitsune-bubble">
          {sample && sampleVisible ? (
            <CardLettering
              className="camera-prompt-art replica-found-art"
              src={assetPath("replica-assets/camera-found.svg")}
              text="キリンがいるよ！"
              highlights={["キリン"]}
            />
          ) : animal ? (
            <BubbleLine
              text={`${animal.name}がいるよ！`}
              highlights={[animal.name]}
            />
          ) : candidate ? (
            <BubbleLine
              text={`${candidate.name}かも！`}
              highlights={[candidate.name]}
            />
          ) : bestMatch && species.modelStatus === "ready" ? (
            <BubbleLine
              text={
                species.checked
                  ? "写真を撮って確かめよう！"
                  : "動物の名前を調べているよ！"
              }
            />
          ) : legacy ? (
            <CardLettering
              className="camera-prompt-art"
              src={assetPath(art + "camera-prompt.svg")}
              text="動物の写真を撮ろう！"
              highlights={["動物の写真"]}
            />
          ) : (
            <BubbleLine text="動物を探しにいこう！" highlights={["動物"]} />
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
            {!streamReady && (legacy || cameraUnavailable) && (
              <div className="camera-fallback">
                <img
                  className="camera-placeholder-art"
                  alt=""
                  src={assetPath(art + "camera-placeholder.svg")}
                />
                {message && (
                  <span role="status">
                    {message}
                    {cameraSettings && <> {cameraSettings.instructions}</>}
                    {!legacy && cameraUnavailable && (
                      <> シャッターで動物を選べます。</>
                    )}
                  </span>
                )}
              </div>
            )}
          </>
        )}
        {sample && sampleVisible && (
          <img
            alt=""
            className="design3-camera-guides"
            src={assetPath("figma/entry/camera-guides.svg")}
          />
        )}
        {bestMatch && (
          <div
            key={bestMatch.id}
            className="replica-camera-tracking"
            aria-hidden="true"
            style={
              {
                "--tracking-left": `${bestMatch.left * 100}%`,
                "--tracking-top": `${bestMatch.top * 100}%`,
                "--tracking-width": `${(bestMatch.right - bestMatch.left) * 100}%`,
                "--tracking-height": `${(bestMatch.bottom - bestMatch.top) * 100}%`,
              } as CSSProperties
            }
          >
            {(
              ["top-left", "top-right", "bottom-left", "bottom-right"] as const
            ).map((corner) => (
              <svg key={corner} data-corner={corner} viewBox="4 4 58 58">
                <path
                  d="M61 4H39C19.67 4 4 19.67 4 39V62"
                  fill="none"
                  stroke="white"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              </svg>
            ))}
          </div>
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
        {!legacy &&
          !sample &&
          !cameraUnavailable &&
          !menuOpen &&
          !suspended &&
          !message &&
          (liveDownloading ||
            photoModelDownloading ||
            (streamReady && canRetryModels)) && (
            <CameraModelDownload
              live={liveDownloading}
              photo={photoModelDownloading}
              deferred={species.modelStatus === "deferred"}
              onRetry={canRetryModels ? retryModels : undefined}
            />
          )}
        {!legacy && (streamReady || sample) && message && (
          <p className="replica-camera-model-status" role="status">
            {message}
            {cameraSettings && <> {cameraSettings.instructions}</>}
          </p>
        )}
        {!legacy &&
          (cameraUnavailable || fallbackSample.current) &&
          message &&
          lastFailure.current !== "insecure" && (
            <div className="live-camera-control">
              <button
                type="button"
                className="text-button"
                onClick={
                  cameraSettings?.canOpen
                    ? () => void openDeviceSettings()
                    : retryUnavailableCamera
                }
              >
                {cameraSettings?.canOpen
                  ? "端末の設定を開く"
                  : "カメラをもう一度開く"}
              </button>
            </div>
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
      {legacy && !sample && cameraUnavailable && message && (
        <div className="replica-camera-alternatives">
          <button className="text-button" onClick={retryUnavailableCamera}>
            カメラをもう一度開く
          </button>
          <button className="text-button" onClick={() => chooseMode(true)}>
            見本写真で体験
          </button>
          <button
            className="text-button"
            onClick={() => submitCapture({ sample: false })}
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

export { ReplicaPhotoReview } from "./ReplicaPhotoReview";
