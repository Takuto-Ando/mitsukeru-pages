import { useEffect, useState } from "react";
import { downloadLiveModel } from "../recognition/liveModel";
import { useLiveModelCached } from "../recognition/useLiveDetection";
import {
  downloadPhotoModel,
  photoModelCached,
  photoModelEvent,
} from "../recognition/photoModel";

export function RecognitionPreparation() {
  const liveReady = useLiveModelCached();
  const [photoReady, setPhotoReady] = useState(false);
  const [preparing, setPreparing] = useState<"live" | "photo">();
  const [message, setMessage] = useState("");
  useEffect(() => {
    let mounted = true;
    void photoModelCached().then((cached) => {
      if (mounted && cached) setPhotoReady(true);
    });
    const ready = () => setPhotoReady(true);
    window.addEventListener(photoModelEvent, ready);
    return () => {
      mounted = false;
      window.removeEventListener(photoModelEvent, ready);
    };
  }, []);

  async function prepareLive() {
    setPreparing("live");
    setMessage("ライブ検出モデルをダウンロードしています…");
    try {
      await downloadLiveModel();
      setMessage("ライブ検出をこのブラウザに保存しました。");
    } catch {
      setMessage("保存できませんでした。通信と空き容量を確認してください。");
    } finally {
      setPreparing(undefined);
    }
  }

  async function preparePhoto() {
    setPreparing("photo");
    setMessage("写真の種識別モデルを準備しています…");
    try {
      await downloadPhotoModel();
      setPhotoReady(true);
      setMessage("写真の種識別モデルをこのブラウザに保存しました。");
    } catch {
      setMessage("保存できませんでした。通信と空き容量を確認してください。");
    } finally {
      setPreparing(undefined);
    }
  }

  return (
    <details className="recognition-settings">
      <summary>動物認識の事前ダウンロード</summary>
      <div className="recognition-downloads">
        <button
          type="button"
          disabled={!!preparing || liveReady}
          onClick={() => void prepareLive()}
        >
          {liveReady
            ? "ライブ検出モデル保存済み"
            : "ライブ検出モデルを保存（約3.7 MB）"}
        </button>
        <button
          type="button"
          disabled={!!preparing || photoReady}
          onClick={() => void preparePhoto()}
        >
          {photoReady
            ? "写真の種識別モデル保存済み"
            : "写真の種識別モデルを保存（約87 MB）"}
        </button>
      </div>
      <p role="status">{message}</p>
      <p className="quiet-note">
        園に行く前に、当日使う端末・ブラウザで準備してください。
      </p>
    </details>
  );
}
