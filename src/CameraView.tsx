import { AnimalSelector } from "./components/AnimalSelector";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ArrowRight, ScanLine } from "lucide-react";
import { animalMedia } from "./content/media";
export function CameraView({
  onSelect,
}: {
  onSelect: (photo?: string, id?: string) => void;
}) {
  const [selectedImage, setSelectedImage] = useState("");
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
  function select(id = "goat") {
    let photo: string | undefined;
    if (status === "live" && video.current?.videoWidth) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1200 / video.current.videoWidth);
      canvas.width = video.current.videoWidth * scale;
      canvas.height = video.current.videoHeight * scale;
      try {
        canvas
          .getContext("2d")
          ?.drawImage(video.current, 0, 0, canvas.width, canvas.height);
        photo = canvas.toDataURL("image/jpeg", 0.8);
      } catch {
        photo = undefined;
      }
    }
    onSelect(selectedImage || photo, id);
  }
  return (
    <div className="camera-page">
      <div className="screen-title">
        <span className="eyebrow">まずは、目の前のどうぶつ。</span>
        <h1>だれを観察する？</h1>
        <p>
          カメラを向けたら、下から動物を選んでね。選ぶとその場の写真を撮ります。
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
      <label className="primary photo-input">
        写真を撮る・画像を選ぶ
        <input
          className="visually-hidden-input"
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > 12 * 1024 * 1024) {
              setMessage("12MB以下の画像を選んでください。");
              return;
            }
            try {
              const bitmap = await createImageBitmap(file);
              const canvas = document.createElement("canvas");
              const scale = Math.min(
                1,
                1200 / Math.max(bitmap.width, bitmap.height),
              );
              canvas.width = bitmap.width * scale;
              canvas.height = bitmap.height * scale;
              canvas
                .getContext("2d")
                ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
              bitmap.close();
              setSelectedImage(canvas.toDataURL("image/jpeg", 0.8));
              setMessage("写真を読み込みました。動物は自分で選んでください。");
            } catch {
              setMessage(
                "この画像は読み込めませんでした。JPEGやPNGを選んでください。",
              );
            }
          }}
        />
      </label>
      {selectedImage && (
        <img
          className="selected-photo"
          src={selectedImage}
          alt="選択した観察写真"
        />
      )}
      <AnimalSelector onSelect={(id) => select(id)} />
      <p className="manual-note">この初期版は、どうぶつを手動で選びます。</p>
      <button className="animal-choice" onClick={() => select()}>
        <img src={animalMedia.goat.src} alt="ヤギのイラスト" />
        <div>
          <small>今回のかんさつ</small>
          <strong>ヤギ</strong>
          <span>目の中の、ひみつを見つけよう。</span>
        </div>
        <ArrowRight size={23} />
      </button>
      <p className="quiet-note">
        動物の自動認識は、まだありません。
        <br />
        見えにくいときは、動物が動くのを待ってみよう。
      </p>
    </div>
  );
}
