import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { parseTaskHash } from "../future/deeplink";

// QRコードで課題へ直行：BarcodeDetector が使える端末だけの簡易スキャナ。
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

function createDetector(): Detector | null {
  const w = window as unknown as {
    BarcodeDetector?: new (options: {
      formats: string[];
    }) => Detector;
  };
  if (!w.BarcodeDetector) return null;
  try {
    return new w.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export function qrScanSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!createDetector() &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function QrScanner({
  onFound,
  onClose,
}: {
  onFound: (taskId: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const detector = createDetector();
    if (!detector) {
      setError("この端末ではQR読み取りに対応していません。");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            for (const code of codes) {
              const url = new URL(code.rawValue, location.href);
              const taskId = parseTaskHash(url.hash);
              if (taskId) {
                stopped = true;
                onFound(taskId);
                return;
              }
            }
          } catch {
            // 読み取り失敗は次のフレームで再試行
          }
          timer = window.setTimeout(tick, 350);
        };
        void tick();
      })
      .catch(() => setError("カメラを開けませんでした。"));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFound]);

  return (
    <section className="qr-scanner" aria-label="QRコード読み取り">
      <div className="quiz-head">
        <h2>QRコードをかざしてね</h2>
        <button type="button" onClick={onClose} aria-label="閉じる">
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <video ref={video} playsInline muted className="qr-video" />
      )}
      <p>動物のポスターのQRを読むと、その動物の課題がすぐ開くよ。</p>
    </section>
  );
}
