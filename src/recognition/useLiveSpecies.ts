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

function sameSubject(first: CameraView, second: CameraView) {
  if (first.zoom !== second.zoom) return false;
  const a = first.box;
  const b = second.box;
  // A brief detector miss or a different COCO label must not discard a
  // fine-grained result computed while the subject was still in view.
  if (!a || !b || a.id === b.id) return true;
  return (
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
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
      const frame = video.current;
      if (!frame?.videoWidth || !frame.videoHeight) {
        // Safari can briefly report zero dimensions during video startup.
        timer = window.setTimeout(nextFrame, 150);
        return;
      }
      if (!speciesRecognizer.isBusy()) {
        const snapshot = view.current;
        const source = recognitionViews(frame, snapshot);
        const focusJustArrived = () =>
          !snapshot.box &&
          !!view.current.box &&
          snapshot.zoom === view.current.zoom;
        if (source.length) {
          ownsWorker = true;
          const { primary, supported, suggestion, unavailable } =
            await recognizeSpeciesViews(
              source,
              () => visible() && !focusJustArrived(),
              undefined,
              (guess, evidence) => {
                const candidate = animalFromCandidate(guess);
                if (
                  !visible() ||
                  !candidate ||
                  !sameSubject(snapshot, view.current)
                )
                  return;
                setResult((prior) =>
                  prior &&
                  sameSubject(prior.snapshot, snapshot) &&
                  (prior.animal ||
                    (prior.candidate && evidence !== "agreement"))
                    ? prior
                    : { snapshot, candidate },
                );
              },
            );
          if (!visible()) return;
          if (unavailable) {
            restart();
            return;
          }
          if (sameSubject(snapshot, view.current)) {
            const speciesId = primary?.speciesId ?? primary?.groupId;
            const same = previous && sameSubject(previous.snapshot, snapshot);
            const keep = !speciesId && !suggestion && same && !previous?.missed;
            const confirmed =
              supported ??
              (same && previous?.speciesId === speciesId ? primary : undefined);
            if (speciesId) previous = { snapshot, speciesId, missed: false };
            else if (keep && previous) previous.missed = true;
            else previous = undefined;
            if (!keep)
              setResult({
                snapshot,
                animal: animalFromCandidate(confirmed),
                candidate: animalFromCandidate(suggestion),
              });
          }
          // The detector can acquire the subject while the full-frame model
          // is running. Use its crop at the next safe point, before cooldown.
          if (focusJustArrived() && !supported) {
            timer = window.setTimeout(nextFrame, 0);
            return;
          }
        }
      }
      // Give the device a break between rounds, especially during long use.
      const now = performance.now();
      const idle = now - lastInteraction >= 25_000;
      timer = window.setTimeout(
        nextFrame,
        Math.max(idle ? 4000 : 1100, (now - began) * 1.5),
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

  const checked =
    active && !!result && sameSubject(result.snapshot, view.current);
  return {
    animal: checked ? result.animal : undefined,
    candidate: checked ? result.candidate : undefined,
    checked,
    modelStatus: active ? modelStatus : undefined,
    prepareManually,
    stop,
  };
}
