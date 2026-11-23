import { useEffect, useState } from "react";
import type { Candidate } from "./labels";
import {
  canAutoDownloadPhotoModel,
  downloadPhotoModel,
  photoDownloadInProgress,
  photoModelDownloading,
  photoModelCached,
  photoModelDownloadEvent,
} from "./photoModel";
import { speciesRecognizer } from "./species";
import {
  photoSpeciesViews,
  recognizeSpeciesViews,
  type PhotoSource,
} from "./speciesViews";

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

export function usePhotoIdentification(
  photo?: string,
  crop?: string,
  tiles?: readonly PhotoSource[],
): Identification {
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
          const pending = photoDownloadInProgress();
          if (!pending && !canAutoDownloadPhotoModel()) {
            update({ message: "写真を見て、動物の名前を選んでください。" });
            return;
          }
          update({ message: "画像認識モデルをダウンロード中…" });
          await (pending ?? downloadPhotoModel());
          update(empty);
        }
        if (!active) return;
        cancelInference = true;
        const prepared = await speciesRecognizer.prepare();
        if (!active) return;
        if (prepared.status !== "ready") throw new Error("unavailable");
        const { candidates } = await recognizeSpeciesViews(
          photoSpeciesViews(image, crop, tiles),
          () => active,
        );
        cancelInference = false;
        if (!active) return;
        speciesRecognizer.unload();
        if (candidates.length) {
          update({
            candidates,
            message: "",
          });
        } else {
          update({ message: "写真を見て、動物の名前を選んでください。" });
        }
      } catch {
        if (active && cancelInference) {
          speciesRecognizer.release();
          speciesRecognizer.unload();
          cancelInference = false;
        }
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
  }, [crop, photo, tiles]);

  return result && result.photo === photo ? result.value : empty;
}
