import { useEffect, useRef, useState, type RefObject } from "react";
import { drawRecognitionFrame, drawTrackedAnimal } from "../camera/zoom";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import {
  downloadPhotoModel,
  photoModelCached,
  photoModelEvent,
} from "./photoModel";
import { speciesRecognizer } from "./species";
import type { TrackedLiveBox } from "./liveBoxes";

type LiveSpecies = { groupId: string; name: string; taskId?: string };

export function useLiveSpecies(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  zoom: number,
  box?: TrackedLiveBox,
) {
  const [result, setResult] = useState<{
    target: string;
    animal?: LiveSpecies;
  }>();
  const stop = useRef<() => void>(() => undefined);
  const target = `${zoom}:${box?.id ?? ""}`;
  const view = useRef({ zoom, box, target });
  view.current = { zoom, box, target };

  useEffect(() => {
    setResult(undefined);
    if (!active) return;
    let running = true;
    let ownsWorker = false;
    let preparing = false;
    let started = false;
    let retried = false;
    let timer = 0;
    let lastInteraction = performance.now();
    const updateInteraction = () => {
      lastInteraction = performance.now();
    };
    let checkFullFrameFor: string | undefined;
    let previous:
      { target: string; speciesId: string; missed: boolean } | undefined;

    async function classifyFrame() {
      if (!running || document.hidden) return;
      const began = performance.now();
      const frame = video.current;
      if (frame && !speciesRecognizer.isBusy()) {
        const { zoom, box, target } = view.current;
        const focused =
          box && checkFullFrameFor !== target
            ? drawTrackedAnimal(frame, zoom, box)
            : undefined;
        const image = focused ?? drawRecognitionFrame(frame, zoom);
        if (image) {
          ownsWorker = true;
          const result = await speciesRecognizer.recognize(
            image.canvas.toDataURL("image/jpeg", 0.8),
          );
          if (!running) return;
          if (result.status === "unavailable") {
            speciesRecognizer.unload();
            ownsWorker = false;
            setResult(undefined);
            started = false;
            retry();
            return;
          }
          const [first, runner] =
            result.status === "candidates" ? result.candidates : [];
          const speciesId = first && (first.speciesId ?? first.groupId);
          const plausible =
            first &&
            first.score >= 0.45 &&
            first.score - (runner?.score ?? 0) >= 0.12;
          const sameSpecies =
            previous?.target === target && previous.speciesId === speciesId;
          const clear =
            result.status === "candidates" &&
            (result.recognition
              ? result.recognition.status === "identified"
              : plausible);
          const species =
            speciesId && (clear || (plausible && sameSpecies))
              ? kyotoSpeciesById.get(speciesId)
              : undefined;
          // Recheck borderline crops with the next full frame. A lower-margin
          // name is shown only when two observations agree for the same target.
          checkFullFrameFor =
            !clear && (focused || plausible) ? target : undefined;
          const hold =
            !speciesId && previous?.target === target && !previous.missed;
          if (speciesId && plausible)
            previous = { target, speciesId, missed: false };
          else if (hold && previous) previous.missed = true;
          else previous = undefined;
          if (view.current.target === target && !hold)
            setResult({
              target,
              animal: species && {
                groupId: species.groupId,
                name: species.name,
                taskId: species.id === "sheep" ? "sheep" : undefined,
              },
            });
        }
      }
      // Sample again promptly after an empty frame, while limiting the
      // sustained workload on phones that take longer to infer.
      const now = performance.now();
      const idle = now - lastInteraction >= 25_000;
      timer = window.setTimeout(
        nextFrame,
        Math.max(idle ? 4200 : 1200, (now - began) * 2.5),
      );
    }

    function retry() {
      if (!running || retried) return;
      retried = true;
      timer = window.setTimeout(prepare, 1500);
    }

    function nextFrame() {
      void classifyFrame().catch(() => {
        if (!running) return;
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
    window.addEventListener("pointerdown", updateInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", updateInteraction);
    void prepare();
    const close = (handoff: boolean) => {
      if (!running) return;
      running = false;
      window.clearTimeout(timer);
      window.removeEventListener(photoModelEvent, modelReady);
      window.removeEventListener("online", resume);
      window.removeEventListener("pointerdown", updateInteraction);
      window.removeEventListener("keydown", updateInteraction);
      if (ownsWorker && !(handoff && speciesRecognizer.keepWarm())) {
        speciesRecognizer.release();
        speciesRecognizer.unload();
      }
    };
    stop.current = () => close(true);
    return () => close(false);
  }, [active, video]);

  const checked = active && result?.target === target;
  return { animal: checked ? result?.animal : undefined, checked, stop };
}
