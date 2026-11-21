import { useEffect } from "react";
import { downloadLiveModel } from "./liveModel";
import { downloadPhotoModel } from "./photoModel";
import { speciesRecognizer } from "./species";

export function useModelPreload({ photo = true } = {}) {
  useEffect(() => {
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
        connection?.type === "cellular" ||
        connection?.effectiveType === "slow-2g" ||
        connection?.effectiveType === "2g";
      live ??= downloadLiveModel().catch(() => undefined);
      void live.then(() => {
        if (
          photo &&
          !startedPhoto &&
          !limited &&
          !document.hidden &&
          navigator.onLine &&
          !speciesRecognizer.isBusy()
        ) {
          startedPhoto = true;
          return downloadPhotoModel().catch(() => undefined);
        }
      });
    }
    const initial = window.setTimeout(prepare, 350);
    window.addEventListener("online", prepare);
    document.addEventListener("visibilitychange", prepare);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("online", prepare);
      document.removeEventListener("visibilitychange", prepare);
    };
  }, [photo]);
}
