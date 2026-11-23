import { useEffect, useRef, useState, type RefObject } from "react";
import { drawCameraFrame } from "../camera/zoom";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import { downloadPhotoModel, photoModelCached } from "./photoModel";
import { speciesRecognizer } from "./species";

type LiveSpecies = { groupId: string; name: string; taskId?: string };

export function useLiveSpecies(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  zoom: number,
) {
  const [animal, setAnimal] = useState<LiveSpecies>();
  const stop = useRef<() => void>(() => undefined);
  const currentZoom = useRef(zoom);
  currentZoom.current = zoom;

  useEffect(() => {
    setAnimal(undefined);
    if (!active) return;
    let running = true;
    let ownsWorker = false;
    let timer = 0;

    async function classifyFrame() {
      if (!running || document.hidden) return;
      const frame = video.current;
      if (frame && !speciesRecognizer.isBusy()) {
        const image = drawCameraFrame(frame, 384, currentZoom.current, [4, 5]);
        if (image) {
          ownsWorker = true;
          const result = await speciesRecognizer.recognize(
            image.canvas.toDataURL("image/jpeg", 0.8),
          );
          if (!running) return;
          if (result.status === "unavailable") {
            speciesRecognizer.unload();
            ownsWorker = false;
            setAnimal(undefined);
            return;
          }
          const [first, runner] =
            result.status === "candidates" ? result.candidates : [];
          const species =
            first?.score >= 0.45 && first.score - (runner?.score ?? 0) >= 0.12
              ? kyotoSpeciesById.get(first.speciesId ?? first.groupId)
              : undefined;
          setAnimal(
            species && {
              groupId: species.groupId,
              name: species.name,
              taskId: species.id === "sheep" ? "sheep" : undefined,
            },
          );
        }
      }
      // Keep just one frame in flight, with a pause to limit sustained workload.
      timer = window.setTimeout(classifyFrame, 8000);
    }

    async function prepare() {
      try {
        if (!(await photoModelCached())) {
          if (!running || !navigator.onLine) return;
          const connection = (
            navigator as Navigator & {
              connection?: { saveData?: boolean; effectiveType?: string };
            }
          ).connection;
          if (
            connection?.saveData ||
            /2g|3g/.test(connection?.effectiveType ?? "")
          )
            return;
          await downloadPhotoModel();
        }
        if (running) void classifyFrame();
      } catch {
        // The fast detector and manual selection are available independently.
      }
    }
    timer = window.setTimeout(prepare, 1500);
    stop.current = () => {
      running = false;
      window.clearTimeout(timer);
      if (ownsWorker) {
        speciesRecognizer.release();
        speciesRecognizer.unload();
        ownsWorker = false;
      }
    };
    return stop.current;
  }, [active, video]);

  return { animal: active ? animal : undefined, stop };
}
