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

type Identification = {
  candidates?: Pick<Candidate, "groupId" | "speciesId">[];
  message: string;
};
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
          if (!pending && !canAutoDownloadPhotoModel()) return;
          update({ message: "画像認識モデルをダウンロード中…" });
          await (pending ?? downloadPhotoModel());
          update(empty);
        }
        if (!active) return;
        const views = photoSpeciesViews(image, crop, tiles);
        for (let attempt = 0; attempt < 2; attempt++) {
          cancelInference = true;
          const prepared = await speciesRecognizer.prepare();
          if (!active) return;
          const result =
            prepared.status === "ready"
              ? await recognizeSpeciesViews(views, () => active)
              : undefined;
          if (!active) return;
          cancelInference = false;
          speciesRecognizer.unload();
          if (!result || result.unavailable) continue;
          const { candidates, referenceGroupId } = result;
          if (candidates.length || referenceGroupId) {
            update({
              candidates: referenceGroupId
                ? [{ groupId: referenceGroupId }]
                : candidates,
              message: "",
            });
          } else update(empty);
          return;
        }
        update({ message: "画像認識を利用できませんでした。" });
      } catch {
        if (active && cancelInference) {
          speciesRecognizer.release();
          speciesRecognizer.unload();
          cancelInference = false;
        }
        update({ message: "画像認識を利用できませんでした。" });
      }
    }

    void identify(photo);
    return () => {
      active = false;
      if (cancelInference) {
        speciesRecognizer.release();
        speciesRecognizer.unload();
      }
    };
  }, [crop, photo, tiles]);

  return result && result.photo === photo ? result.value : empty;
}
