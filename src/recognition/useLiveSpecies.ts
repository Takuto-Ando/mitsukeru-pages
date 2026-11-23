import { useEffect, useRef, useState, type RefObject } from "react";
import { drawCameraFrame } from "../camera/zoom";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import {
  downloadPhotoModel,
  photoModelCached,
  photoModelEvent,
} from "./photoModel";
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
    let preparing = false;
    let started = false;
    let retried = false;
    let timer = 0;

    async function classifyFrame() {
      if (!running || document.hidden) return;
      const began = performance.now();
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
            started = false;
            retry();
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
      // Sample again promptly after an empty frame, while limiting the
      // sustained workload on phones that take longer to infer.
      timer = window.setTimeout(
        nextFrame,
        Math.max(1200, (performance.now() - began) * 3),
      );
    }

    function retry() {
      if (!running || retried) return;
      retried = true;
      timer = window.setTimeout(prepare, 1500);
    }

    function nextFrame() {
      void classifyFrame().catch(() => {
        speciesRecognizer.unload();
        ownsWorker = false;
        started = false;
        retry();
      });
    }

    async function prepare() {
      if (!running || preparing || started || document.hidden) return;
      preparing = true;
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
        if (!running) return;
        ownsWorker = true;
        const result = await speciesRecognizer.prepare();
        if (!running) return;
        if (result.status === "ready") {
          started = true;
          nextFrame();
        } else {
          retry();
        }
      } catch {
        retry();
      } finally {
        preparing = false;
      }
    }
    function resume() {
      if (started) return;
      retried = false;
      window.clearTimeout(timer);
      void prepare();
    }
    function modelReady() {
      if (!started) void prepare();
    }
    window.addEventListener(photoModelEvent, modelReady);
    window.addEventListener("online", resume);
    void prepare();
    stop.current = () => {
      running = false;
      window.clearTimeout(timer);
      window.removeEventListener(photoModelEvent, modelReady);
      window.removeEventListener("online", resume);
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
