import { useEffect, useRef, useState, type RefObject } from "react";
import {
  cameraWindow,
  inputSize,
  trackLiveBoxes,
  type LiveBox,
  type TrackedLiveBox,
} from "./liveBoxes";
import { liveModelCached, liveModelEvent } from "./liveModel";

export function useLiveModelCached() {
  const [cached, setCached] = useState(false);
  useEffect(() => {
    let mounted = true;
    const check = () =>
      void liveModelCached().then((ready) => {
        if (mounted) setCached(ready);
      });
    const markCached = () => setCached(true);
    check();
    window.addEventListener(liveModelEvent, markCached);
    window.addEventListener("pageshow", check);
    return () => {
      mounted = false;
      window.removeEventListener(liveModelEvent, markCached);
      window.removeEventListener("pageshow", check);
    };
  }, []);
  return cached;
}

const IDLE_AFTER_MS = 25_000;
// A cold worker fetches the ONNX WASM binary (about 14 MiB on a host
// without compression). At 1.6 Mbps the transfer alone takes ~75 seconds.
// Keep the shorter deadline for inference after the runtime is ready.
const WORKER_PREPARATION_MS = 120_000;

function limitedHardware() {
  const { hardwareConcurrency, deviceMemory, connection } =
    navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
  return (
    (hardwareConcurrency > 0 && hardwareConcurrency <= 4) ||
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    connection?.saveData === true
  );
}

export function useLiveDetection(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  zoom: number,
  retry = 0,
) {
  const [result, setResult] = useState<{
    status: "idle" | "starting" | "running" | "error";
    boxes: TrackedLiveBox[];
  }>({
    status: "idle",
    boxes: [],
  });
  const currentZoom = useRef(zoom);
  currentZoom.current = zoom;

  useEffect(() => {
    if (!active) {
      setResult({ status: "idle", boxes: [] });
      return;
    }
    let stopSession: (() => void) | undefined;
    let lastInteraction = performance.now();
    const slowDevice = limitedHardware();
    const updateInteraction = () => {
      lastInteraction = performance.now();
    };
    const stop = () => {
      stopSession?.();
      stopSession = undefined;
      setResult({ status: "idle", boxes: [] });
    };
    const resume = () => {
      if (document.hidden || stopSession) return;
      updateInteraction();
      stopSession = startSession();
    };
    const handleVisibility = () => {
      if (document.hidden) stop();
      else resume();
    };

    function startSession() {
      setResult({ status: "starting", boxes: [] });
      let worker: Worker | undefined;
      let timer = 0;
      let watchdog = 0;
      let closed = false;
      let frameAspect = 0;
      let frameZoom = currentZoom.current;
      let nextId = 0;
      let tracked: TrackedLiveBox[] = [];
      let frameStartedAt = 0;
      const input = document.createElement("canvas");
      input.width = input.height = inputSize;
      const context = input.getContext("2d", { willReadFrequently: true });

      function close() {
        if (closed) return;
        closed = true;
        window.clearTimeout(timer);
        window.clearTimeout(watchdog);
        worker?.terminate();
        input.width = input.height = 0;
      }
      function fail() {
        if (closed) return;
        close();
        setResult({ status: "error", boxes: [] });
      }
      function nextFrame() {
        const element = video.current;
        if (closed || document.hidden || !worker || !context) return;
        if (
          !element?.videoWidth ||
          !element.videoHeight ||
          !element.clientWidth ||
          !element.clientHeight
        ) {
          tracked = [];
          setResult({ status: "running", boxes: [] });
          timer = window.setTimeout(nextFrame, 300);
          return;
        }
        try {
          frameStartedAt = performance.now();
          const aspect = element.clientWidth / element.clientHeight;
          const zoom = currentZoom.current;
          if (frameZoom !== zoom || Math.abs(frameAspect - aspect) >= 0.015)
            tracked = [];
          frameAspect = aspect;
          frameZoom = zoom;
          const crop = cameraWindow(
            element.videoWidth,
            element.videoHeight,
            aspect,
            zoom,
          );
          const scale = inputSize / Math.max(crop.width, crop.height);
          const width = Math.max(1, Math.round(crop.width * scale));
          const height = Math.max(1, Math.round(crop.height * scale));
          context.fillStyle = "#727272";
          context.fillRect(0, 0, inputSize, inputSize);
          context.drawImage(
            element,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            width,
            height,
          );
          const pixels = context.getImageData(0, 0, inputSize, inputSize).data
            .buffer as ArrayBuffer;
          worker.postMessage({ type: "frame", pixels, width, height }, [
            pixels,
          ]);
          watchdog = window.setTimeout(fail, 8_000);
        } catch {
          fail();
        }
      }
      try {
        if (!context) throw new Error("Camera input canvas unavailable");
        worker = new Worker(new URL("./live.worker.ts", import.meta.url), {
          type: "module",
          name: "zooketch-live-detection",
        });
        worker.onerror = fail;
        worker.onmessage = ({
          data,
        }: MessageEvent<
          { type: "ready" | "error" } | { type: "boxes"; boxes: LiveBox[] }
        >) => {
          if (closed || document.hidden) return;
          window.clearTimeout(watchdog);
          if (data.type === "ready") nextFrame();
          else if (data.type === "boxes") {
            const element = video.current;
            const fits =
              element &&
              frameZoom === currentZoom.current &&
              Math.abs(
                frameAspect - element.clientWidth / element.clientHeight,
              ) < 0.015;
            tracked = fits
              ? trackLiveBoxes(tracked, data.boxes, () => ++nextId)
              : [];
            setResult({ status: "running", boxes: tracked });
            const now = performance.now();
            const elapsed = now - frameStartedAt;
            // Wait for each inference to finish; keep CPU duty cycle low on
            // slower devices even when no platform hardware hint is exposed.
            const recovery = Math.max(
              slowDevice ? 720 : 420,
              Math.min(2400, elapsed * (slowDevice ? 2 : 1.5)),
            );
            const idle = now - lastInteraction >= IDLE_AFTER_MS;
            timer = window.setTimeout(
              nextFrame,
              idle ? Math.max(recovery, 1500) : recovery,
            );
          } else fail();
        };
        worker.postMessage({ type: "prepare" });
        watchdog = window.setTimeout(fail, WORKER_PREPARATION_MS);
      } catch {
        fail();
      }
      return close;
    }

    resume();
    document.addEventListener("pointerdown", updateInteraction, {
      passive: true,
    });
    document.addEventListener("keydown", updateInteraction);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", resume);
    return () => {
      stopSession?.();
      document.removeEventListener("pointerdown", updateInteraction);
      document.removeEventListener("keydown", updateInteraction);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", resume);
    };
  }, [active, retry, video]);
  return result;
}
