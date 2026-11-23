import { useEffect, useState } from "react";
import type { Candidate } from "./labels";
import {
  downloadPhotoModel,
  photoModelDownloading,
  photoModelCached,
  photoModelDownloadEvent,
} from "./photoModel";
import { speciesRecognizer } from "./species";

export function usePhotoModelDownloading() {
  const [downloading, setDownloading] = useState(photoModelDownloading);
  useEffect(() => {
    const update = () => setDownloading(photoModelDownloading());
    window.addEventListener(photoModelDownloadEvent, update);
    update();
    return () => window.removeEventListener(photoModelDownloadEvent, update);
  }, []);
  return downloading;
}

type Identification = { candidates?: Candidate[]; message: string };
const empty: Identification = { message: "" };

export function usePhotoIdentification(photo?: string): Identification {
  // Keep the result bound to the exact captured image. A late inference cannot
  // select a species for a retaken photo.
  const [result, setResult] = useState<{
    photo: string;
    value: Identification;
  }>();
  useEffect(() => {
    if (!photo?.startsWith("data:image/")) return;
    let active = true;
    let cancelInference = false;
    const update = (value: Identification) => {
      if (active) setResult({ photo, value });
    };

    async function identify(image: string) {
      try {
        if (!(await photoModelCached())) {
          if (!active) return;
          if (!navigator.onLine) throw new Error("offline");
          update({ message: "画像認識モデルをダウンロード中…" });
          await downloadPhotoModel();
        }
        if (!active) return;
        update({ message: "写真から動物の候補を探しています…" });
        cancelInference = true;
        const prepared = await speciesRecognizer.prepare();
        if (!active) return;
        if (prepared.status !== "ready") throw new Error("unavailable");
        const outcome = await speciesRecognizer.recognize(image, (message) =>
          update({ message }),
        );
        cancelInference = false;
        speciesRecognizer.unload();
        if (outcome.status === "candidates") {
          update({
            candidates: outcome.candidates,
            message: outcome.candidates.length
              ? ""
              : "写真を見て、動物の名前を選んでください。",
          });
        } else {
          update({ message: "写真を見て、動物の名前を選んでください。" });
        }
      } catch {
        update({
          message:
            "画像認識を利用できませんでした。動物の名前を選んでください。",
        });
      }
    }

    void identify(photo);
    return () => {
      active = false;
      if (cancelInference) speciesRecognizer.release();
    };
  }, [photo]);

  return result && result.photo === photo ? result.value : empty;
}
