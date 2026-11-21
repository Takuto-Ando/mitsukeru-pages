import { useEffect, useRef, useState } from "react";
import { cameraWindow } from "../recognition/liveBoxes";

type Zoom = 0.5 | 1 | 2;
type ZoomCapabilities = MediaTrackCapabilities & {
  zoom?: { min: number; max: number };
};

export function useCameraZoom(track?: MediaStreamTrack, sample = false) {
  const [zoom, setZoom] = useState<Zoom>(1);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const activeTrack = useRef(track);
  activeTrack.current = track;

  useEffect(() => {
    setZoom(1);
    setBusy(false);
    pending.current = false;
  }, [track, sample]);

  let wide = sample;
  try {
    const range = (track?.getCapabilities?.() as ZoomCapabilities | undefined)
      ?.zoom;
    wide ||= !!(range && range.min <= 0.5 && range.max >= 1);
  } catch {
    // This camera does not expose an optical zoom range.
  }

  async function changeZoom(value: Zoom) {
    if (pending.current || (value === 0.5 && !wide) || value === zoom) return;
    if (track && (value === 0.5 || zoom === 0.5)) {
      pending.current = true;
      setBusy(true);
      const setting: MediaTrackConstraintSet & { zoom: number } = {
        zoom: value === 0.5 ? 0.5 : 1,
      };
      try {
        await track.applyConstraints({ advanced: [setting] });
        if (activeTrack.current !== track) return;
        const actual = (
          track.getSettings?.() as
            (MediaTrackSettings & { zoom?: number }) | undefined
        )?.zoom;
        if (actual !== undefined && Math.abs(actual - setting.zoom) > 0.05)
          return;
      } catch {
        return;
      } finally {
        if (activeTrack.current === track) {
          pending.current = false;
          setBusy(false);
        }
      }
    }
    setZoom(value);
  }
  return { zoom, wide, busy, changeZoom, digital: zoom === 2 ? 2 : 1 };
}

export function drawCameraFrame(
  source: HTMLVideoElement | HTMLImageElement,
  maxSize: number,
  digital: number,
  ratio?: readonly [width: number, height: number],
) {
  const video = source instanceof HTMLVideoElement;
  const sourceWidth = video ? source.videoWidth : source.naturalWidth;
  const sourceHeight = video ? source.videoHeight : source.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;
  const aspect = ratio ? ratio[0] / ratio[1] : sourceWidth / sourceHeight;
  const crop = cameraWindow(sourceWidth, sourceHeight, aspect, digital);
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  if (ratio) {
    const units = Math.max(1, Math.floor((crop.width * scale) / ratio[0]));
    canvas.width = units * ratio[0];
    canvas.height = units * ratio[1];
  } else {
    canvas.width = Math.round(crop.width * scale);
    canvas.height = Math.round(crop.height * scale);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return { canvas, context };
}
