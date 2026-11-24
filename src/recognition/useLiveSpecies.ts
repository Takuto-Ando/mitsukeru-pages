import { useEffect, useRef, useState, type RefObject } from "react";
import { drawPhotoRecognitionFrames } from "../camera/zoom";
import { adoptedAnimalById } from "../content/adoptedAnimals";
import {
  canAutoDownloadPhotoModel,
  downloadPhotoModel,
  photoDownloadInProgress,
  photoModelCached,
  photoModelEvent,
} from "./photoModel";
import { speciesRecognizer } from "./species";
import {
  photoFromCanvas,
  photoSpeciesViews,
  photoViewQuality,
  recognizeSpeciesViews,
} from "./speciesViews";
import type { TrackedLiveBox } from "./liveBoxes";
import type { Candidate } from "./labels";

type LiveSpecies = { groupId: string; name: string; taskId?: string };
type CameraView = { zoom: number; box?: TrackedLiveBox };
const LIVE_INFERENCE_TIMEOUT_MS = 15_000;

function animalFromCandidate(candidate?: Candidate): LiveSpecies | undefined {
  const id = candidate?.speciesId ?? candidate?.groupId;
  const animal = id && adoptedAnimalById.get(id);
  return animal
    ? {
        groupId: animal.id,
        name: animal.name,
        taskId: id === "sheep" ? "sheep" : undefined,
      }
    : undefined;
}

function sameReadingArea(first: CameraView, second: CameraView) {
  if (!sameTarget(first, second)) return false;
  const a = first.box;
  const b = second.box;
  if (a === b) return true;
  if (!a || !b) return false;
  // Ignore detector jitter, but compare against the crop that was actually
  // sampled so small movements that accumulate also trigger a new reading.
  const x = Math.max(
    0.025,
    0.18 * Math.min(a.right - a.left, b.right - b.left),
  );
  const y = Math.max(
    0.025,
    0.18 * Math.min(a.bottom - a.top, b.bottom - b.top),
  );
  return (
    Math.abs(a.left - b.left) <= x &&
    Math.abs(a.right - b.right) <= x &&
    Math.abs(a.top - b.top) <= y &&
    Math.abs(a.bottom - b.bottom) <= y
  );
}

function sameTarget(first: CameraView, second: CameraView) {
  return first.zoom === second.zoom && first.box?.id === second.box?.id;
}

function recognitionViews(video: HTMLVideoElement, { zoom, box }: CameraView) {
  const frames = drawPhotoRecognitionFrames(video, zoom, box);
  if (!frames) return [];
  return photoSpeciesViews(
    photoFromCanvas(frames.full, photoViewQuality.full),
    frames.crop && photoFromCanvas(frames.crop, photoViewQuality.crop),
    frames.tiles.map((tile) => photoFromCanvas(tile, photoViewQuality.crop)),
  );
}

export function useLiveSpecies(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  frameReady: boolean,
  zoom: number,
  box?: TrackedLiveBox,
) {
  const [result, setResult] = useState<{
    snapshot: CameraView;
    animal?: LiveSpecies;
    candidate?: LiveSpecies;
  }>();
  const [modelStatus, setModelStatus] = useState<
    "preparing" | "deferred" | "ready" | "failed"
  >();
  const stop = useRef<() => void>(() => undefined);
  const prepareManually = useRef<() => void>(() => undefined);
  const onFrameReady = useRef<() => void>(() => undefined);
  const onSubjectChange = useRef<() => void>(() => undefined);
  const hasFrame = useRef(frameReady);
  hasFrame.current = frameReady;
  const view = useRef<CameraView>({ zoom, box });
  view.current = { zoom, box };

  useEffect(() => {
    setResult(undefined);
    setModelStatus(undefined);
    if (!active) return;
    let running = true;
    let ownsWorker = false;
    let preparing = false;
    let started = false;
    let retried = false;
    let workerFailed = false;
    let waitingForFrame = false;
    let timer = 0;
    let coolingView: CameraView | undefined;
    let quickChecks = 0;
    let lastInteraction = performance.now();
    let previous:
      { snapshot: CameraView; speciesId: string; missed: boolean } | undefined;
    const visible = () => running && !document.hidden;
    const updateInteraction = () => {
      lastInteraction = performance.now();
    };

    async function classifyFrame() {
      if (!visible()) return;
      if (!hasFrame.current) {
        waitingForFrame = true;
        return;
      }
      const began = performance.now();
      const snapshot = view.current;
      let needsConfirmation = false;
      const frame = video.current;
      if (!frame?.videoWidth || !frame.videoHeight) {
        // Safari can briefly report zero dimensions during video startup.
        timer = window.setTimeout(nextFrame, 150);
        return;
      }
      if (!speciesRecognizer.isBusy()) {
        const source = recognitionViews(frame, snapshot);
        if (source.length) {
          const current = () => visible() && sameTarget(snapshot, view.current);
          ownsWorker = true;
          const { primary, supported, suggestion, unavailable } =
            await recognizeSpeciesViews(
              source,
              current,
              undefined,
              (guess) => {
                const candidate = animalFromCandidate(guess);
                if (!candidate || !current()) return;
                setResult((prior) => {
                  if (
                    prior &&
                    sameTarget(prior.snapshot, snapshot) &&
                    prior.animal?.name === candidate.name
                  )
                    return prior;
                  // Keep a suggestion separate from the capture's answer.
                  return { snapshot, candidate };
                });
              },
              (photo, progress, fit) =>
                speciesRecognizer.recognize(
                  photo,
                  progress,
                  fit,
                  LIVE_INFERENCE_TIMEOUT_MS,
                ),
            );
          if (!visible()) return;
          if (unavailable) {
            restart();
            return;
          }
          if (current()) {
            retried = false;
            const speciesId = primary?.speciesId ?? primary?.groupId;
            const same = previous && sameTarget(previous.snapshot, snapshot);
            const keep = !speciesId && !suggestion && same && !previous?.missed;
            const confirmed =
              supported ??
              (same &&
              previous?.speciesId === speciesId &&
              primary === suggestion
                ? primary
                : undefined);
            needsConfirmation =
              !confirmed && (!!snapshot.box || !!suggestion || !!keep);
            if (speciesId) previous = { snapshot, speciesId, missed: false };
            else if (keep && previous) previous.missed = true;
            else previous = undefined;
            if (!keep)
              setResult({
                snapshot,
                animal: animalFromCandidate(confirmed),
                candidate: animalFromCandidate(suggestion),
              });
          } else {
            // Let the worker finish its current call, then switch to the
            // latest crop without running more views or entering cooldown.
            setResult(undefined);
            previous = undefined;
            updateInteraction();
            quickChecks = 0;
            timer = window.setTimeout(nextFrame, 0);
            return;
          }
        }
      }
      // Give the device a break between rounds, especially during long use.
      const now = performance.now();
      const idle = now - lastInteraction >= 25_000;
      if (!needsConfirmation) quickChecks = 0;
      const quick = needsConfirmation && !idle && quickChecks < 2;
      if (quick) quickChecks += 1;
      // A detector update for the same animal should refresh the crop, but
      // must never cancel the running round or erase its visible name.
      const moved = !sameReadingArea(snapshot, view.current);
      const normalRecovery = (now - began) * 1.5;
      coolingView = snapshot;
      timer = window.setTimeout(
        nextFrame,
        moved || quick
          ? 650
          : Math.max(
              idle ? 4000 : 1100,
              needsConfirmation
                ? Math.min(4000, normalRecovery)
                : normalRecovery,
            ),
      );
    }

    function retry() {
      if (!running || retried) return false;
      retried = true;
      timer = window.setTimeout(() => void prepare(), 1500);
      return true;
    }

    function restart() {
      if (!running) return;
      workerFailed ||= ownsWorker;
      speciesRecognizer.unload();
      ownsWorker = false;
      started = false;
      previous = undefined;
      setResult(undefined);
      setModelStatus(retry() ? "preparing" : "failed");
    }

    function nextFrame() {
      coolingView = undefined;
      void classifyFrame().catch(restart);
    }

    async function prepare(manual = false) {
      if (!visible() || preparing || started) return;
      preparing = true;
      try {
        const replace = manual && workerFailed;
        if (replace || !(await photoModelCached())) {
          if (!visible()) return;
          const pending = photoDownloadInProgress();
          if (!pending && !manual && !canAutoDownloadPhotoModel()) {
            setModelStatus("deferred");
            return;
          }
          setModelStatus("preparing");
          await (pending ?? downloadPhotoModel({ replace }));
          workerFailed = false;
        }
        if (!visible()) return;
        setModelStatus("preparing");
        ownsWorker = true;
        const prepared = await speciesRecognizer.prepare();
        if (!visible()) return;
        if (prepared.status === "ready") {
          started = true;
          setModelStatus("ready");
          nextFrame();
        } else {
          restart();
        }
      } catch {
        restart();
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
    onFrameReady.current = () => {
      if (!waitingForFrame) return;
      waitingForFrame = false;
      nextFrame();
    };
    onSubjectChange.current = () => {
      if (!visible() || !coolingView) return;
      if (sameReadingArea(coolingView, view.current)) return;
      window.clearTimeout(timer);
      updateInteraction();
      if (!sameTarget(coolingView, view.current)) {
        setResult(undefined);
        previous = undefined;
        quickChecks = 0;
      }
      nextFrame();
    };
    window.addEventListener(photoModelEvent, modelReady);
    window.addEventListener("online", resume);
    window.addEventListener("pointerdown", updateInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", updateInteraction);
    void prepare();
    prepareManually.current = () => {
      if (started || preparing) return;
      retried = false;
      window.clearTimeout(timer);
      void prepare(true);
    };
    const close = (handoff: boolean) => {
      if (!running) return;
      running = false;
      prepareManually.current = () => undefined;
      onFrameReady.current = () => undefined;
      onSubjectChange.current = () => undefined;
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
  useEffect(() => {
    if (frameReady) onFrameReady.current();
  }, [frameReady]);

  useEffect(() => {
    onSubjectChange.current();
  }, [box, zoom]);

  const checked =
    active && !!result && sameTarget(result.snapshot, view.current);
  return {
    animal: checked ? result.animal : undefined,
    candidate: checked ? result.candidate : undefined,
    checked,
    modelStatus: active ? modelStatus : undefined,
    prepareManually,
    stop,
  };
}
