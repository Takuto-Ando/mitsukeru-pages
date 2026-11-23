import { useEffect, useRef, useState, type RefObject } from "react";
import { drawPhotoRecognitionFrames } from "../camera/zoom";
import { kyotoSpeciesById } from "../content/kyotoCatalog";
import {
  canAutoDownloadPhotoModel,
  downloadPhotoModel,
  photoDownloadInProgress,
  photoModelCached,
  photoModelEvent,
} from "./photoModel";
import { speciesRecognizer, type SpeciesPhoto } from "./species";
import { recognizePhotoSpecies } from "./speciesViews";
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

function cameraViewPhoto(canvas: HTMLCanvasElement, quality: number) {
  let image: Promise<SpeciesPhoto | undefined> | undefined;
  // Encode only a crop the recognizer actually requests. Crop and contain
  // share the encoded image, and the live frame never needs a base64 string.
  return () =>
    (image ??= new Promise((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob ?? undefined),
        "image/jpeg",
        quality,
      ),
    ));
}

type PhotoFrames = NonNullable<ReturnType<typeof drawPhotoRecognitionFrames>>;
type PhotoFingerprint = { full: Uint8ClampedArray; crop?: Uint8ClampedArray };

function photoFingerprint({
  full,
  crop,
}: PhotoFrames): PhotoFingerprint | undefined {
  const thumbnail = document.createElement("canvas");
  thumbnail.width = thumbnail.height = 12;
  const context = thumbnail.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const read = (image: HTMLCanvasElement) => {
    context.drawImage(image, 0, 0, thumbnail.width, thumbnail.height);
    return context.getImageData(0, 0, thumbnail.width, thumbnail.height).data;
  };
  return { full: read(full), crop: crop && read(crop) };
}

function matchesFrame(
  first: Uint8ClampedArray | undefined,
  second: Uint8ClampedArray | undefined,
) {
  if (!first || !second) return first === second;
  let total = 0;
  let changed = 0;
  for (let index = 0; index < first.length; index += 4) {
    const difference =
      Math.abs(first[index] - second[index]) +
      Math.abs(first[index + 1] - second[index + 1]) +
      Math.abs(first[index + 2] - second[index + 2]);
    total += difference;
    if (difference > 48) changed++;
  }
  // Allow small exposure changes and motion while rejecting a different
  // picture even if both pictures happen to share the same tracking box.
  return changed <= 12 && total <= (first.length / 4) * 30;
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
    candidates?: Candidate[];
    fingerprint?: PhotoFingerprint;
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
        const frames = drawPhotoRecognitionFrames(
          frame,
          snapshot.zoom,
          snapshot.box,
        );
        if (frames) {
          const current = () =>
            visible() && sameReadingArea(snapshot, view.current);
          ownsWorker = true;
          const { primary, supported, suggestion, candidates, unavailable } =
            await recognizePhotoSpecies(
              {
                full: cameraViewPhoto(frames.full, 0.8),
                crop: frames.crop && cameraViewPhoto(frames.crop, 0.85),
              },
              current,
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
              (same &&
              previous?.speciesId === speciesId &&
              primary === suggestion
                ? primary
                : undefined);
            needsConfirmation = !confirmed && (!!suggestion || !!keep);
            if (speciesId) previous = { snapshot, speciesId, missed: false };
            else if (keep && previous) previous.missed = true;
            else previous = undefined;
            if (!keep) {
              const animal = animalFromCandidate(confirmed);
              const candidate = animalFromCandidate(suggestion);
              setResult({
                snapshot,
                animal,
                candidate,
                candidates,
                fingerprint:
                  animal || candidate ? photoFingerprint(frames) : undefined,
              });
            }
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
    matchCapture(frames: PhotoFrames) {
      if (!checked || !result.fingerprint) return;
      const current = photoFingerprint(frames);
      if (
        current &&
        matchesFrame(result.fingerprint.full, current.full) &&
        matchesFrame(result.fingerprint.crop, current.crop)
      )
        return { animal: result.animal, candidates: result.candidates };
    },
    modelStatus: active ? modelStatus : undefined,
    prepareManually,
    stop,
  };
}
