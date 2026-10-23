import { AnimalSelector } from "./components/AnimalSelector";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { speciesRecognizer } from "./recognition/species";
import { motion, useReducedMotion } from "motion/react";
export function CameraView({
  onSelect,
}: {
  onSelect: (photo?: string, id?: string) => void;
}) {
  const [captured, setCaptured] = useState("");
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0);
  const [status, setStatus] = useState<"waiting" | "live" | "failed">(
      "waiting",
    ),
    [message, setMessage] = useState("");
  useEffect(
    () => () => {
      generation.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function start() {
    const request = ++generation.current;
    setStatus("waiting");
    setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (request !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      if (request === generation.current) setStatus("live");
    } catch {
      if (request !== generation.current) return;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setStatus("failed");
      setMessage(
        "カメラを使えなくても大丈夫。下から動物を選んで、同じ体験を始められます。",
      );
    }
  }
  useEffect(() => {
    void start();
  }, []);
  async function capture() {
    if (busy || !video.current?.videoWidth || status !== "live") return;
    setBusy(true);
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
      setCaptured(image);
      const result = await speciesRecognizer.recognize(image);
      if (result.status === "recognized") onSelect(image, result.groupId);
      else {
        setMessage(result.reason);
      }
    } catch {
      setMessage("撮影できませんでした。カメラをもう一度試してください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="camera-page">
      <div className="screen-title">
        <h1>どの動物を見ている？</h1>
        <p>写真を撮っても、下から動物を選んでも始められるよ。</p>
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
              <CameraOff size={38} />
            ) : (
              <Camera size={38} />
            )}
            <strong>
              {status === "failed"
                ? "手動で始められるよ"
                : "カメラを準備しています"}
            </strong>
            <span>動物から少し離れて、そっと観察しよう。</span>
          </div>
        )}
        <ScanLine className="viewfinder" aria-hidden="true" />
        <span className="camera-tag">
          {status === "live" ? "カメラで観察中" : "かんさつカメラ"}
        </span>
      </div>
      {message && (
        <p className="camera-message" role="status">
          {message}
          <button className="text-button" onClick={() => void start()}>
            カメラをもう一度試す
          </button>
        </p>
      )}
      {captured && (
        <motion.img
          key={captured}
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="selected-photo"
          src={captured}
          alt="撮影した動物の写真"
        />
      )}
      <button
        className="primary"
        disabled={status !== "live" || busy}
        onClick={() => void capture()}
      >
        {busy ? "写真を確認中…" : captured ? "もう一度撮る" : "シャッター"}
      </button>
      <p className="quiet-note">
        自動認識モデルは準備中です。下の動物を選ぶと観察を始められます。
      </p>
      {captured && <p role="status">撮影した写真を見て、動物を選んでね。</p>}
      <AnimalSelector onSelect={(id) => onSelect(captured, id)} />
      <p className="quiet-note">
        写真は端末内だけで扱い、外部に送信しません。描くときは実物を観察してね。
      </p>
    </div>
  );
}
