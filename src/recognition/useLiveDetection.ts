import { useEffect, useState, type RefObject } from "react";
import { cameraWindow, inputSize, type LiveBox } from "./liveBoxes";
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

export function useLiveDetection(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  zoom: number,
) {
  const [result, setResult] = useState<{
    status: "idle" | "starting" | "running" | "error";
    boxes: LiveBox[];
  }>({
    status: "idle",
    boxes: [],
  });
  useEffect(() => {
    if (!active) {
      setResult({ status: "idle", boxes: [] });
      return;
    }
    setResult({ status: "starting", boxes: [] });
    let worker: Worker | undefined;
    let timer = 0;
    let watchdog = 0;
    let closed = false;
    let aspect = 0;
    const input = document.createElement("canvas");
    input.width = input.height = inputSize;
    const context = input.getContext("2d", { willReadFrequently: true });
    function stop() {
      closed = true;
      window.clearTimeout(timer);
      window.clearTimeout(watchdog);
      worker?.terminate();
    }
    function fail() {
      stop();
      setResult({ status: "error", boxes: [] });
    }
    function nextFrame() {
      const element = video.current;
      if (closed || !worker || !context) return;
      if (
        !element?.videoWidth ||
        !element.videoHeight ||
        !element.clientWidth ||
        !element.clientHeight ||
        document.hidden
      ) {
        setResult({ status: "running", boxes: [] });
        timer = window.setTimeout(nextFrame, 300);
        return;
      }
      try {
        aspect = element.clientWidth / element.clientHeight;
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
        worker.postMessage({ type: "frame", pixels, width, height }, [pixels]);
        watchdog = window.setTimeout(fail, 8_000);
      } catch {
        fail();
      }
    }
    try {
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
        if (closed) return;
        window.clearTimeout(watchdog);
        if (data.type === "ready") nextFrame();
        else if (data.type === "boxes") {
          const element = video.current;
          const fits =
            element &&
            Math.abs(aspect - element.clientWidth / element.clientHeight) <
              0.015;
          setResult({ status: "running", boxes: fits ? data.boxes : [] });
          timer = window.setTimeout(nextFrame, 420);
        } else fail();
      };
      worker.postMessage({ type: "prepare" });
      watchdog = window.setTimeout(fail, 20_000);
    } catch {
      fail();
    }
    return stop;
  }, [active, video, zoom]);
  return result;
}
