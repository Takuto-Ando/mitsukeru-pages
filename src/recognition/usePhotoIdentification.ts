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

export function usePhotoIdentification(
  photo?: string,
  crop?: string,
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
        const reportProgress = (message: string) => update({ message });
        const focused = crop
          ? await speciesRecognizer.recognize(crop, reportProgress)
          : undefined;
        if (!active) return;
        const sure =
          focused?.status === "candidates" &&
          focused.recognition?.status === "identified";
        const outcome =
          focused && sure
            ? focused
            : await speciesRecognizer.recognize(image, reportProgress);
        cancelInference = false;
        speciesRecognizer.unload();
        const candidates = new Map<string, Candidate>();
        for (const result of [outcome, focused]) {
          if (result?.status !== "candidates") continue;
          for (const candidate of result.candidates) {
            const id = candidate.speciesId ?? candidate.groupId;
            if (!candidates.has(id)) candidates.set(id, candidate);
          }
        }
        if (candidates.size) {
          update({
            candidates: [...candidates.values()].slice(0, 3),
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
  }, [crop, photo]);

  return result && result.photo === photo ? result.value : empty;
}
