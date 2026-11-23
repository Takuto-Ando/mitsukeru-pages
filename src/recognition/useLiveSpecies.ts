import { useEffect, useRef, useState, type RefObject } from "react";
import {
  drawCameraFrame,
  drawRecognitionFrame,
  drawTrackedAnimal,
} from "../camera/zoom";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import {
  canAutoDownloadPhotoModel,
  downloadPhotoModel,
  photoDownloadInProgress,
  photoModelCached,
  photoModelEvent,
} from "./photoModel";
import { speciesRecognizer, type SpeciesPhoto } from "./species";
import { recognizeSpeciesViews, type SpeciesView } from "./speciesViews";
import type { TrackedLiveBox } from "./liveBoxes";
import type { Candidate } from "./labels";

type LiveSpecies = { groupId: string; name: string; taskId?: string };
type CameraView = { zoom: number; box?: TrackedLiveBox };

function animalFromCandidate(candidate?: Candidate): LiveSpecies | undefined {
  const id = candidate?.speciesId ?? candidate?.groupId;
  const species = id && kyotoSpeciesById.get(id);
  return species
    ? {
        groupId: species.groupId,
        name: species.name,
        taskId: id === "sheep" ? "sheep" : undefined,
      }
    : undefined;
}

function sameReadingArea(first: CameraView, second: CameraView) {
  if (first.zoom !== second.zoom) return false;
  const a = first.box;
  const b = second.box;
  if (a === b) return true;
  if (!a || !b || a.id !== b.id) return false;
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

function cameraViewPhoto(canvas: HTMLCanvasElement) {
  let image: Promise<SpeciesPhoto | undefined> | undefined;
  // Encode only a crop the recognizer actually requests. Crop and contain
  // share the encoded image, and the live frame never needs a base64 string.
  return () =>
    (image ??= new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob ?? undefined), "image/jpeg", 0.85),
    ));
}

function recognitionViews(video: HTMLVideoElement, { zoom, box }: CameraView) {
  const whole = drawRecognitionFrame(video, zoom);
  if (!whole) return [];
  const photo = cameraViewPhoto(whole.canvas);
  const wholeViews: SpeciesView[] = [{ photo }, { photo, fit: "contain" }];
  const focused = box && drawTrackedAnimal(video, zoom, box);
  if (!focused) return wholeViews;

  const focusPhoto = cameraViewPhoto(focused.canvas);
  const views: SpeciesView[] = [
    { photo: focusPhoto, source: "focus" },
    { photo: focusPhoto, fit: "contain", source: "focus" },
    wholeViews[0],
  ];
  const ratio = [video.clientWidth || 4, video.clientHeight || 5] as const;
  const aspect = ratio[0] / ratio[1];
  const width = 0.68 * Math.min(1, 1 / aspect);
  const height = 0.68 * Math.min(1, aspect);
  for (const position of [0.5, 0.26, 0.74]) {
    const left = Math.max(0, Math.min(1 - width, position - width / 2));
    const region = drawCameraFrame(video, 384, zoom, ratio, {
      left,
      top: (1 - height) / 2,
      right: left + width,
      bottom: (1 + height) / 2,
    });
    if (region)
      views.push({
        photo: cameraViewPhoto(region.canvas),
        source: "tile",
      });
  }
  // If the direct views were ambiguous, try a tighter crop before another
  // whole-frame pass. The recognized name can still use all available votes.
  views.push(wholeViews[1]);
  return views;
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
          const current = () =>
            visible() && sameReadingArea(snapshot, view.current);
          ownsWorker = true;
          const { primary, supported, suggestion, unavailable } =
            await recognizeSpeciesViews(
              source,
              current,
              undefined,
              (guess, evidence) => {
                const candidate = animalFromCandidate(guess);
                if (!candidate || !current()) return;
                setResult((prior) => {
                  if (prior && sameReadingArea(prior.snapshot, snapshot)) {
                    if (prior.animal?.name === candidate.name) return prior;
                    if (!evidence && (prior.animal || prior.candidate))
                      return prior;
                  }
                  // Show the new name as a suggestion. Only the completed
                  // multi-view check may make it the capture's chosen animal.
                  return { snapshot, candidate };
                });
              },
            );
          if (!visible()) return;
          if (unavailable) {
            restart();
            return;
          }
          if (current()) {
            const speciesId = primary?.speciesId ?? primary?.groupId;
            const same =
              previous && sameReadingArea(previous.snapshot, snapshot);
            const keep = !speciesId && !suggestion && same && !previous?.missed;
            const confirmed =
              supported ??
              (same && previous?.speciesId === speciesId ? primary : undefined);
            needsConfirmation = !confirmed && (!!suggestion || !!keep);
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
      coolingView = snapshot;
      timer = window.setTimeout(
        nextFrame,
        quick ? 650 : Math.max(idle ? 4000 : 1100, (now - began) * 1.5),
      );
    }

    function retry() {
      if (!running || retried) return;
      retried = true;
      timer = window.setTimeout(() => void prepare(), 1500);
    }

    function restart() {
      if (!running) return;
      speciesRecognizer.unload();
      ownsWorker = false;
      started = false;
      previous = undefined;
      setResult(undefined);
      setModelStatus("failed");
      retry();
    }

    function nextFrame() {
      coolingView = undefined;
      void classifyFrame().catch(restart);
    }

    async function prepare(manual = false) {
      if (!visible() || preparing || started) return;
      preparing = true;
      try {
        if (!(await photoModelCached())) {
          if (!visible()) return;
          const pending = photoDownloadInProgress();
          if (!pending && !manual && !canAutoDownloadPhotoModel()) {
            setModelStatus("deferred");
            return;
          }
          setModelStatus("preparing");
          await (pending ?? downloadPhotoModel());
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
      setResult(undefined);
      previous = undefined;
      updateInteraction();
      quickChecks = 0;
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
    active && !!result && sameReadingArea(result.snapshot, view.current);
  return {
    animal: checked ? result.animal : undefined,
    candidate: checked ? result.candidate : undefined,
    checked,
    modelStatus: active ? modelStatus : undefined,
    prepareManually,
    stop,
  };
}
