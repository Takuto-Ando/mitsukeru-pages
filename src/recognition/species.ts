import type { SpeciesRecognition } from "./contracts";
import type { Candidate } from "./labels";
export type SpeciesImageFit = "crop" | "contain";
export type SpeciesPhoto = string | Blob;
export type SpeciesResult =
  | { status: "ready" }
  | {
      status: "candidates";
      candidates: Candidate[];
      recognition?: SpeciesRecognition;
    }
  | { status: "unknown" | "unavailable"; reason: string };
export interface SpeciesRecognizer {
  recognize(
    photo: SpeciesPhoto,
    progress?: (text: string) => void,
    fit?: SpeciesImageFit,
  ): Promise<SpeciesResult>;
  prepare(progress?: (text: string) => void): Promise<SpeciesResult>;
  isReady(): boolean;
  isBusy(): boolean;
  keepWarm(): boolean;
  release(): void;
  unload(): void;
  cancel(): void;
}
let ready = false;
let preparation: Promise<SpeciesResult> | undefined;
let idleWarmTimer: ReturnType<typeof setTimeout> | undefined;
let worker: Worker | undefined,
  finish: ((r: SpeciesResult) => void) | undefined;
const stopInBackground = () => {
  if (document.hidden) cancel();
};
function stopWorker() {
  clearTimeout(idleWarmTimer);
  worker?.terminate();
  worker = undefined;
  ready = false;
  document.removeEventListener("visibilitychange", stopInBackground);
  window.removeEventListener("pagehide", cancel);
}
function cancel() {
  stopWorker();
  finish?.({
    status: "unavailable",
    reason: "候補の検索を中止しました。手動でも選べます。",
  });
  finish = undefined;
}
export const speciesRecognizer: SpeciesRecognizer = {
  cancel,
  isReady: () => ready,
  isBusy: () => !!finish,
  keepWarm: () => {
    if (!ready || finish) return false;
    clearTimeout(idleWarmTimer);
    idleWarmTimer = setTimeout(() => speciesRecognizer.unload(), 8_000);
    return true;
  },
  release: () => {
    if (finish) cancel();
  },
  unload: () => {
    if (finish) return;
    stopWorker();
  },
  prepare: (progress) => {
    if (ready) return Promise.resolve({ status: "ready" });
    if (preparation) return preparation;
    if (finish)
      return Promise.resolve({
        status: "unavailable",
        reason: "別の写真を確認中です。",
      });
    preparation = run(undefined, progress)
      .then((result) => {
        if (result.status === "ready")
          idleWarmTimer = setTimeout(() => speciesRecognizer.unload(), 45_000);
        return result;
      })
      .finally(() => {
        preparation = undefined;
      });
    return preparation;
  },
  recognize: (photo, progress, fit) => run(photo, progress, fit),
};
async function run(
  photo?: SpeciesPhoto,
  progress?: (text: string) => void,
  fit?: SpeciesImageFit,
): Promise<SpeciesResult> {
  if (typeof photo === "string" && !photo.startsWith("data:image/"))
    return { status: "unavailable", reason: "撮影した写真がありません。" };
  if (typeof Worker === "undefined")
    return {
      status: "unavailable",
      reason: "この環境では簡易AIを利用できません。",
    };
  if (finish)
    return { status: "unavailable", reason: "別の写真を確認中です。" };
  if (document.hidden)
    return {
      status: "unavailable",
      reason: "候補の検索を中止しました。手動でも選べます。",
    };
  if (photo) clearTimeout(idleWarmTimer);
  return new Promise<SpeciesResult>((resolve) => {
    const timer = setTimeout(cancel, 180000);
    finish = (r) => {
      clearTimeout(timer);
      finish = undefined;
      resolve(r);
    };
    try {
      if (!worker) {
        worker = new Worker(new URL("./species.worker.ts", import.meta.url), {
          type: "module",
          name: "zooketch-species-recognition",
        });
        document.addEventListener("visibilitychange", stopInBackground);
        window.addEventListener("pagehide", cancel);
      }
      worker.onmessage = (e) => {
        if (e.data.type === "progress") progress?.(e.data.text);
        else if (e.data.type === "result") {
          ready = e.data.result.status !== "unavailable";
          finish?.(e.data.result);
        }
      };
      worker.onerror = () => {
        stopWorker();
        finish?.({
          status: "unavailable",
          reason: "簡易AIが停止しました。手動で選んでください。",
        });
      };
      worker.postMessage({ photo, fit });
    } catch {
      cancel();
    }
  });
}
