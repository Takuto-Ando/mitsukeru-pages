import { useEffect, useRef, useState } from "react";
import { cameraWindow, type LiveBox } from "../recognition/liveBoxes";

type Zoom = 0.5 | 1 | 2;
export const cameraPhotoRatio = [4, 5] as const;
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
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  maxSize: number,
  digital: number,
  ratio?: readonly [width: number, height: number],
  focus?: Pick<LiveBox, "left" | "top" | "right" | "bottom">,
) {
  const [sourceWidth, sourceHeight] =
    source instanceof HTMLVideoElement
      ? [source.videoWidth, source.videoHeight]
      : source instanceof HTMLImageElement
        ? [source.naturalWidth, source.naturalHeight]
        : [source.width, source.height];
  if (!sourceWidth || !sourceHeight) return;
  const aspect = ratio ? ratio[0] / ratio[1] : sourceWidth / sourceHeight;
  const visible = cameraWindow(sourceWidth, sourceHeight, aspect, digital);
  const crop = focus
    ? {
        x: visible.x + visible.width * focus.left,
        y: visible.y + visible.height * focus.top,
        width: visible.width * (focus.right - focus.left),
        height: visible.height * (focus.bottom - focus.top),
      }
    : visible;
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  const units =
    ratio && !focus ? Math.floor((crop.width * scale) / ratio[0]) : 0;
  if (ratio && units > 0) {
    canvas.width = units * ratio[0];
    canvas.height = units * ratio[1];
  } else {
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
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

// Use the same visible crop as the tracking worker. Give the animal room
// around its silhouette without giving the enclosure most of the input.
function drawTrackedAnimal(
  video: HTMLVideoElement,
  zoom: number,
  box: LiveBox,
  captured: HTMLCanvasElement,
) {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  if (
    !video.clientWidth ||
    !video.clientHeight ||
    width < 0.07 ||
    height < 0.07
  )
    return;
  const horizontal = Math.max(0.04, width * 0.15);
  const vertical = Math.max(0.04, height * 0.15);
  const focus = {
    left: Math.max(0, box.left - horizontal),
    top: Math.max(0, box.top - vertical),
    right: Math.min(1, box.right + horizontal),
    bottom: Math.min(1, box.bottom + vertical),
  };
  if ((focus.right - focus.left) * (focus.bottom - focus.top) >= 0.8) return;
  return drawPreviewRegion(video, zoom, captured, focus);
}

function drawPreviewRegion(
  video: HTMLVideoElement,
  zoom: number,
  captured: HTMLCanvasElement,
  region: Pick<LiveBox, "left" | "top" | "right" | "bottom">,
) {
  // Preview and saved photo can have different aspect ratios.
  const { videoWidth, videoHeight } = video;
  const preview = cameraWindow(
    videoWidth,
    videoHeight,
    video.clientWidth / video.clientHeight,
    zoom,
  );
  const photo = cameraWindow(
    videoWidth,
    videoHeight,
    captured.width / captured.height,
    zoom,
  );
  const normalized = {
    left: Math.max(
      0,
      (preview.x + preview.width * region.left - photo.x) / photo.width,
    ),
    top: Math.max(
      0,
      (preview.y + preview.height * region.top - photo.y) / photo.height,
    ),
    right: Math.min(
      1,
      (preview.x + preview.width * region.right - photo.x) / photo.width,
    ),
    bottom: Math.min(
      1,
      (preview.y + preview.height * region.bottom - photo.y) / photo.height,
    ),
  };
  if (
    normalized.right - normalized.left < 0.07 ||
    normalized.bottom - normalized.top < 0.07
  )
    return;
  return drawCameraFrame(captured, 384, 1, undefined, normalized);
}

export function drawPhotoRecognitionFrames(
  video: HTMLVideoElement,
  zoom: number,
  box?: LiveBox,
  captured = drawCameraFrame(video, 1000, zoom, cameraPhotoRatio)?.canvas,
) {
  if (!captured) return;
  const full = drawCameraFrame(captured, 384, 1, cameraPhotoRatio)?.canvas;
  if (!full) return;
  const crop = box && drawTrackedAnimal(video, zoom, box, captured)?.canvas;
  const aspect = video.clientWidth / video.clientHeight;
  const width = 0.68 * Math.min(1, 1 / aspect);
  const height = 0.68 * Math.min(1, aspect);
  const tiles = crop
    ? [0.5, 0.26, 0.74].flatMap((position) => {
        const left = Math.max(0, Math.min(1 - width, position - width / 2));
        const tile = drawPreviewRegion(video, zoom, captured, {
          left,
          top: (1 - height) / 2,
          right: left + width,
          bottom: (1 + height) / 2,
        });
        return tile ? [tile.canvas] : [];
      })
    : [];
  return { full, crop, tiles };
}
