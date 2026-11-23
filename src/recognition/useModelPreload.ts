import { useEffect } from "react";
import { downloadLiveModel } from "./liveModel";
import { downloadPhotoModel } from "./photoModel";
import { speciesRecognizer } from "./species";

export function useModelPreload({
  photo = true,
  enabled = true,
  allowMetered = false,
  warmPhoto = false,
} = {}) {
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let live: Promise<void | undefined> | undefined;
    let startedPhoto = false;

    function prepare() {
      if (document.hidden || !navigator.onLine) return;
      const connection = (
        navigator as Navigator & {
          connection?: {
            saveData?: boolean;
            type?: string;
            effectiveType?: string;
          };
        }
      ).connection;
      const limited =
        connection?.saveData ||
        (!allowMetered &&
          (connection?.type === "cellular" ||
            connection?.effectiveType === "slow-2g" ||
            connection?.effectiveType === "2g"));

      live ??= downloadLiveModel().catch(() => {
        live = undefined;
      });
      void live.then(() => {
        if (
          !disposed &&
          photo &&
          !startedPhoto &&
          !limited &&
          !document.hidden &&
          navigator.onLine &&
          !speciesRecognizer.isBusy()
        ) {
          startedPhoto = true;
          return downloadPhotoModel()
            .then(() => {
              if (warmPhoto && !disposed && !document.hidden)
                return speciesRecognizer.prepare();
            })
            .catch(() => {
              startedPhoto = false;
            });
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
  }, [allowMetered, enabled, photo, warmPhoto]);
}
