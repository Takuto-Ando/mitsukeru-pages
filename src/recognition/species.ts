import type { PhotoReferenceSuggestion, SpeciesRecognition } from "./contracts";
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
  | {
      status: "unknown";
      reason: string;
      referenceSuggestion?: PhotoReferenceSuggestion;
    }
  | { status: "unavailable"; reason: string };
export interface SpeciesRecognizer {
  recognize(
    photo: SpeciesPhoto,
    progress?: (text: string) => void,
    fit?: SpeciesImageFit,
    timeoutMs?: number,
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
const modelRequestTimeout = 180_000;
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
function failRequest(reason: string) {
  stopWorker();
  finish?.({ status: "unavailable", reason });
}
function cancel() {
  failRequest("候補の検索を中止しました。手動でも選べます。");
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
  recognize: (photo, progress, fit, timeoutMs) =>
    run(photo, progress, fit, timeoutMs),
};
async function run(
  photo?: SpeciesPhoto,
  progress?: (text: string) => void,
  fit?: SpeciesImageFit,
  timeoutMs = modelRequestTimeout,
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
  // Live callers can recover a stalled warm inference sooner, while loading
  // the model and identifying a still photo keep their existing budget.
  const requestTimeout = ready && photo ? timeoutMs : modelRequestTimeout;
  return new Promise<SpeciesResult>((resolve) => {
    const timer = setTimeout(() => {
      failRequest("動物の識別に時間がかかっています。");
    }, requestTimeout);
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
      const requestWorker = worker;
      requestWorker.onmessage = (e) => {
        if (worker !== requestWorker) return;
        if (e.data.type === "progress") progress?.(e.data.text);
        else if (e.data.type === "result") {
          ready = e.data.result.status !== "unavailable";
          finish?.(e.data.result);
        }
      };
      const workerFailed = () => {
        if (worker !== requestWorker) return;
        failRequest("簡易AIが停止しました。手動で選んでください。");
      };
      requestWorker.onerror = workerFailed;
      requestWorker.onmessageerror = workerFailed;
      requestWorker.postMessage({ photo, fit });
    } catch {
      cancel();
    }
  });
}
