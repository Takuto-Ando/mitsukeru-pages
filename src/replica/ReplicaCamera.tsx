import { useEffect, useRef, useState } from "react";
import { assetPath } from "../content/artwork";
import { CameraShutter, CameraZoom } from "../components/CameraControls";
import { drawCameraFrame, useCameraZoom } from "../camera/zoom";

export const samplePhoto = () =>
  assetPath("replica-assets/giraffe-example.png");

type Capture = {
  photo?: string;
  sample: boolean;
};

export function ReplicaCamera({
  tutorial,
  framedExample,
  onCapture,
  onGallery,
  onHome,
  onFreeDraw,
}: {
  tutorial: boolean;
  framedExample: boolean;
  onCapture: (capture: Capture) => void;
  onGallery: () => void;
  onHome: () => void;
  onFreeDraw: () => void;
}) {
  const [sample, setSample] = useState(tutorial || framedExample);
  const [sampleHasAnimal, setSampleHasAnimal] = useState(framedExample);
  const [streamReady, setStreamReady] = useState(false);
  const [cameraTrack, setCameraTrack] = useState<MediaStreamTrack>();
  const cameraZoom = useCameraZoom(cameraTrack, sample);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestNumber, retryCamera] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const video = useRef<HTMLVideoElement>(null);
  const example = useRef<HTMLImageElement>(null);
  const sampleVisible = sampleHasAnimal || cameraZoom.zoom === 0.5;
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (sample || menuOpen || !visible) return;
    let active = true;
    const element = video.current;
    function stopCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = undefined;
      setCameraTrack(undefined);
      if (element) element.srcObject = null;
      setStreamReady(false);
    }
    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("この端末ではカメラを開けません。");
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
        if (active) setMessage("");
      } catch {
        if (!active) return;
        stopCamera();
        setMessage("カメラを開けませんでした。");
      }
    }
    void startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [menuOpen, requestNumber, sample, visible]);

  useEffect(() => {
    if (menuOpen) menu.current?.showModal();
  }, [menuOpen]);

  function chooseMode(nextSample: boolean) {
    setSample(nextSample);
    setSampleHasAnimal(false);
    setMessage("");
    setMenuOpen(false);
  }

  function takePhoto() {
    if (sample) {
      if (!sampleVisible) {
        setSampleHasAnimal(true);
        return;
      }
      const zoomed =
        cameraZoom.digital > 1 && example.current
          ? drawCameraFrame(example.current, 1000, cameraZoom.digital)?.canvas
          : undefined;
      onCapture({
        photo: zoomed?.toDataURL("image/jpeg", 0.82) ?? samplePhoto(),
        sample: true,
      });
      return;
    }

    const frame = video.current;
    if (!frame?.videoWidth || !frame.videoHeight) return;
    try {
      const shot = drawCameraFrame(frame, 1000, cameraZoom.digital);
      if (!shot) return;
      onCapture({
        photo: shot.canvas.toDataURL("image/jpeg", 0.82),
        sample: false,
      });
    } catch {
      setMessage("撮影できませんでした。もう一度試してね。");
    }
  }

  const art = "illustrations/pdf-design/";
  return (
    <section className="camera-page design3-camera replica-camera">
      <h1 className="sr-only">動物を撮影しよう</h1>
      <div className="camera-pitsune">
        <img
          alt=""
          className="camera-pitsune-face"
          src={assetPath("figma/entry/camera-face.svg")}
        />
        <p className="pitsune-bubble">
          {sample && sampleVisible ? (
            <img
              className="camera-prompt-art replica-found-art"
              src={assetPath("replica-assets/camera-found.svg")}
              alt="キリンがいるよ！"
            />
          ) : (
            <img
              className="camera-prompt-art"
              src={assetPath(art + "camera-prompt.svg")}
              alt="動物の写真を撮ろう！"
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
              alt={
                sampleVisible
                  ? "見本写真のキリン"
                  : "キリンの見本写真を拡大した背景"
              }
            />
            <span className="replica-sample-label">見本写真</span>
            {sampleVisible && (
              <img
                alt=""
                className="design3-camera-guides"
                src={assetPath("figma/entry/camera-guides.svg")}
              />
            )}
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
                </span>
              </div>
            )}
          </>
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
          <img
            alt=""
            className="camera-side-label"
            src={assetPath(art + "camera-gallery-label.svg")}
          />
        </button>
        <CameraShutter
          disabled={(!sample && !streamReady) || cameraZoom.busy}
          onClick={takePhoto}
        />
        <button
          type="button"
          className="camera-side-button"
          aria-label="マイページ"
          onClick={() => setMenuOpen(true)}
          disabled={tutorial}
        >
          <img
            alt=""
            className="camera-side-icon"
            src={assetPath(art + "camera-profile.svg")}
          />
          <img
            alt=""
            className="camera-side-label"
            src={assetPath(art + "camera-profile-label.svg")}
          />
        </button>
      </div>
      {!sample && message && (
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
