import { test, expect } from "vitest";
import { createResearchRecorder } from "../../src/research/recorder";
test("記録は同意後のみ。描画時間・やり直し・確認・解説を試行ごとに集計", () => {
  let now = 0;
  const recorder = createResearchRecorder(() => now);
  recorder.record("goat", "start");
  expect(recorder.summaries()).toEqual([]);
  recorder.enable({ obtained: true });
  recorder.record("goat", "start");
  now = 100;
  recorder.record("goat", "drawing-start");
  now = 1100;
  recorder.record("goat", "drawing-end");
  recorder.record("goat", "revision", "erase");
  recorder.record("goat", "hint");
  recorder.record("goat", "judgment", "automatic:uncertain");
  recorder.record("goat", "self-confirmation");
  recorder.record("goat", "explanation");
  now = 2000;
  recorder.record("goat", "end");
  recorder.record("goat", "start");
  const [first, second] = recorder.summaries();
  expect(first).toMatchObject({
    durationMs: 2000,
    drawingMs: 1000,
    revisions: 1,
    hintsUsed: true,
    judgments: ["automatic:uncertain"],
    selfConfirmed: true,
    explanationViewed: true,
  });
  expect(second).toMatchObject({
    drawingMs: 0,
    revisions: 0,
    selfConfirmed: false,
  });
  expect(second.endedAt).toBeUndefined();
  recorder.disable();
  expect(recorder.summaries()).toEqual([]);
});
