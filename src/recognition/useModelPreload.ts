import { useEffect } from "react";
import { downloadLiveModel } from "./liveModel";
import {
  canAutoDownloadPhotoModel,
  downloadPhotoModel,
  photoModelCached,
} from "./photoModel";
import { speciesRecognizer } from "./species";

export function useModelPreload({
  photo = true,
  enabled = true,
  warmPhoto = false,
} = {}) {
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let live: Promise<void | undefined> | undefined;
    let startedPhoto = false;

    function prepare() {
      if (document.hidden || !navigator.onLine) return;
      live ??= downloadLiveModel().catch(() => {
        live = undefined;
      });
      void live.then(async () => {
        if (
          !disposed &&
          photo &&
          !startedPhoto &&
          !document.hidden &&
          navigator.onLine &&
          !speciesRecognizer.isBusy()
        ) {
          startedPhoto = true;
          try {
            const cached = await photoModelCached();
            if (disposed || document.hidden) {
              startedPhoto = false;
              return;
            }
            if (!cached) {
              if (!canAutoDownloadPhotoModel()) {
                startedPhoto = false;
                return;
              }
              await downloadPhotoModel();
            }
            if (warmPhoto && !disposed && !document.hidden)
              await speciesRecognizer.prepare();
          } catch {
            startedPhoto = false;
          }
        }
      });
    }
    const initial = window.setTimeout(prepare, 350);
    window.addEventListener("online", prepare);
    document.addEventListener("visibilitychange", prepare);
    return () => {
      disposed = true;
      window.clearTimeout(initial);
      window.removeEventListener("online", prepare);
      document.removeEventListener("visibilitychange", prepare);
    };
  }, [enabled, photo, warmPhoto]);
}
