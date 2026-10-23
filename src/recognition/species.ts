import type { Candidate } from "./labels";
export type SpeciesResult =
  | { status: "ready" }
  | { status: "candidates"; candidates: Candidate[] }
  | { status: "unknown" | "unavailable"; reason: string };
export interface SpeciesRecognizer {
  recognize(
    photo: string,
    progress?: (text: string) => void,
  ): Promise<SpeciesResult>;
  prepare(progress?: (text: string) => void): Promise<SpeciesResult>;
  isReady(): boolean;
  release(): void;
  cancel(): void;
}
let ready = false;
let worker: Worker | undefined,
  finish: ((r: SpeciesResult) => void) | undefined;
function cancel() {
  worker?.terminate();
  worker = undefined;
  ready = false;
  finish?.({
    status: "unavailable",
    reason: "候補の検索を中止しました。手動でも選べます。",
  });
  finish = undefined;
}
export const speciesRecognizer: SpeciesRecognizer = {
  cancel,
  isReady: () => ready,
  release: () => {
    if (finish) cancel();
  },
  prepare: (progress) => run(undefined, progress),
  recognize: (photo, progress) => run(photo, progress),
};
async function run(
  photo?: string,
  progress?: (text: string) => void,
): Promise<SpeciesResult> {
  if (photo !== undefined && !photo.startsWith("data:image/"))
    return { status: "unavailable", reason: "撮影した写真がありません。" };
  if (typeof Worker === "undefined")
    return {
      status: "unavailable",
      reason: "この環境では簡易AIを利用できません。",
    };
  if (finish)
    return { status: "unavailable", reason: "別の写真を確認中です。" };
  return new Promise<SpeciesResult>((resolve) => {
    const timer = setTimeout(cancel, 180000);
    finish = (r) => {
      clearTimeout(timer);
      finish = undefined;
      resolve(r);
    };
    try {
      worker ??= new Worker(new URL("./species.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => {
        if (e.data.type === "progress") progress?.(e.data.text);
        else if (e.data.type === "result") {
          ready = e.data.result.status !== "unavailable";
          finish?.(e.data.result);
        }
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = undefined;
        ready = false;
        finish?.({
          status: "unavailable",
          reason: "簡易AIが停止しました。手動で選んでください。",
        });
      };
      worker.postMessage({ photo });
    } catch {
      cancel();
    }
  });
}
