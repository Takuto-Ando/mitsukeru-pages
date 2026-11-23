import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  speciesRecognizer,
  type SpeciesResult,
} from "../../src/recognition/species";

class WorkerDouble {
  static instances: WorkerDouble[] = [];
  onmessage?: (event: {
    data: { type: string; result: SpeciesResult };
  }) => void;
  terminate = vi.fn();
  postMessage = vi.fn();

  constructor() {
    WorkerDouble.instances.push(this);
  }

  respond(result: SpeciesResult) {
    this.onmessage?.({ data: { type: "result", result } });
  }
}

beforeEach(() => {
  WorkerDouble.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("Worker", WorkerDouble);
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => {
  speciesRecognizer.cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("応答のないライブ推論を打ち切り、次のワーカーで再開できる", async () => {
  const prepare = speciesRecognizer.prepare();
  const [stalled] = WorkerDouble.instances;
  stalled.respond({ status: "ready" });
  await prepare;

  const live = speciesRecognizer.recognize(
    new Blob(),
    undefined,
    "crop",
    15_000,
  );
  await vi.advanceTimersByTimeAsync(15_000);
  await expect(live).resolves.toMatchObject({ status: "unavailable" });
  expect(stalled.terminate).toHaveBeenCalledOnce();
  expect(speciesRecognizer.isBusy()).toBe(false);

  const retry = speciesRecognizer.prepare();
  const replacement = WorkerDouble.instances[1];
  stalled.respond({ status: "unavailable", reason: "古い応答" });
  expect(speciesRecognizer.isBusy()).toBe(true);
  replacement.respond({ status: "ready" });
  await expect(retry).resolves.toEqual({ status: "ready" });
});

test("通常の写真とモデル準備にはライブ推論だけの短い上限を使わない", async () => {
  const prepare = speciesRecognizer.prepare();
  const [worker] = WorkerDouble.instances;
  await vi.advanceTimersByTimeAsync(15_000);
  expect(speciesRecognizer.isBusy()).toBe(true);
  worker.respond({ status: "ready" });
  await prepare;

  const photo = speciesRecognizer.recognize("data:image/jpeg;base64,");
  await vi.advanceTimersByTimeAsync(15_000);
  expect(speciesRecognizer.isBusy()).toBe(true);
  worker.respond({ status: "unknown", reason: "候補なし" });
  await expect(photo).resolves.toMatchObject({ status: "unknown" });
  expect(worker.terminate).not.toHaveBeenCalled();
});
