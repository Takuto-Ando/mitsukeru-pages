import { useEffect, useRef, useState } from "react";
import { assetPath } from "../content/artwork";

export const samplePhoto = () =>
  assetPath("replica-assets/giraffe-example.png");

type Capture = {
  photo?: string;
  sample: boolean;
};

export function ReplicaCamera({
  tutorial,
  onCapture,
  onGallery,
  onHome,
  onFreeDraw,
}: {
  tutorial: boolean;
  onCapture: (capture: Capture) => void;
  onGallery: () => void;
  onHome: () => void;
  onFreeDraw: () => void;
}) {
  const [sample, setSample] = useState(tutorial);
  const [sampleHasAnimal, setSampleHasAnimal] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestNumber, retryCamera] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const video = useRef<HTMLVideoElement>(null);
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
    setZoom(1);
    setMessage("");
    setMenuOpen(false);
  }

  async function changeZoom(value: number) {
    setZoom(value);
    const track = streamRef.current?.getVideoTracks()[0];
    const range = (
      track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { zoom?: { min: number; max: number } })
        | undefined
    )?.zoom;
    if (!track || !range || value < range.min || value > range.max) return;
    const constraint: MediaTrackConstraintSet & { zoom: number } = {
      zoom: value,
    };
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      // Some desktop browsers expose a camera but reject lens changes.
    }
  }

  function takePhoto() {
    if (sample) {
      if (!sampleHasAnimal) {
        setSampleHasAnimal(true);
        return;
      }
      onCapture({ photo: samplePhoto(), sample: true });
      return;
    }

    const frame = video.current;
    if (!frame?.videoWidth || !frame.videoHeight) return;
    try {
      const photo = document.createElement("canvas");
      const scale = Math.min(
        1,
        1000 / Math.max(frame.videoWidth, frame.videoHeight),
      );
      photo.width = Math.round(frame.videoWidth * scale);
      photo.height = Math.round(frame.videoHeight * scale);
      const context = photo.getContext("2d");
      if (!context) return;
      context.drawImage(frame, 0, 0, photo.width, photo.height);
      onCapture({ photo: photo.toDataURL("image/jpeg", 0.82), sample: false });
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
          {sample && sampleHasAnimal ? (
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
              data-framed={sampleHasAnimal || zoom === 0.5}
              src={samplePhoto()}
              alt={
                sampleHasAnimal
                  ? "見本写真のキリン"
                  : "キリンの見本写真を拡大した背景"
              }
            />
            <span className="replica-sample-label">見本写真</span>
            {sampleHasAnimal && (
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
        <div className="design3-zoom" role="group" aria-label="カメラのズーム">
          {[0.5, 1].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={value + "×"}
              aria-pressed={zoom === value}
              onClick={() => void changeZoom(value)}
            >
              <span
                aria-hidden
                className={
                  value === 0.5
                    ? "zoom-mark zoom-mark--half"
                    : "zoom-mark zoom-mark--one"
                }
              />
            </button>
          ))}
        </div>
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
        <button
          className="shutter-button"
          type="button"
          aria-label="シャッター"
          disabled={!sample && !streamReady}
          onClick={takePhoto}
        >
          <img alt="" src={assetPath("figma/entry/shutter.svg")} />
        </button>
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
