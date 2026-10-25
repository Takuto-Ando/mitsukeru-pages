import { test, expect } from "vitest";
import { createResearchRecorder } from "../../src/research/recorder";
import { analyzeStudy } from "../../src/research/analysis";
import {
  safeStudyDetails,
  sanitizeParticipantCode,
  studyCsv,
  type StudyEvent,
} from "../../src/research/study";

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

test("研究イベントログから10項目の分析指標を算出し、個人情報・画像を除外する", () => {
  expect(sanitizeParticipantCode("user@example.com")).toBe("userexamplecom");
  expect(sanitizeParticipantCode("")).toMatch(/^P-[a-f0-9]{8}$/);
  expect(
    safeStudyDetails({
      method: "automatic",
      status: "correct",
      hintLevel: 2,
      photo: "data:image/jpeg;base64,xxx",
      gps: "35.0,135.0",
      name: "Taro",
    }),
  ).toEqual({
    method: "automatic",
    status: "correct",
    hintLevel: 2,
  });

  const base = {
    sessionId: "s1",
    participantCode: "P-01",
    animalId: "goat",
    taskId: "goat",
    attemptId: "a1",
  };
  const events: StudyEvent[] = [
    {
      ...base,
      id: "1",
      sequence: 1,
      event: "session_started",
      timestamp: "2026-10-24T01:00:00.000Z",
    },
    {
      ...base,
      id: "2",
      sequence: 2,
      event: "challenge_opened",
      timestamp: "2026-10-24T01:00:01.000Z",
    },
    {
      ...base,
      id: "3",
      sequence: 3,
      event: "hint_opened",
      timestamp: "2026-10-24T01:00:02.000Z",
      details: { hintLevel: 1 },
    },
    {
      ...base,
      id: "4",
      sequence: 4,
      event: "drawing_started",
      timestamp: "2026-10-24T01:00:04.000Z",
      details: { tool: "pen" },
    },
    {
      ...base,
      id: "5",
      sequence: 5,
      event: "drawing_stopped",
      timestamp: "2026-10-24T01:00:07.000Z",
      details: { tool: "pen" },
    },
    {
      ...base,
      id: "6",
      sequence: 6,
      event: "drawing_undo",
      timestamp: "2026-10-24T01:00:08.000Z",
    },
    {
      ...base,
      id: "7",
      sequence: 7,
      event: "drawing_cleared",
      timestamp: "2026-10-24T01:00:09.000Z",
    },
    {
      ...base,
      id: "8",
      sequence: 8,
      event: "drawing_started",
      timestamp: "2026-10-24T01:00:10.000Z",
      details: { tool: "pen" },
    },
    {
      ...base,
      id: "9",
      sequence: 9,
      event: "drawing_stopped",
      timestamp: "2026-10-24T01:00:12.000Z",
      details: { tool: "pen" },
    },
    {
      ...base,
      id: "10",
      sequence: 10,
      event: "drawing_submitted",
      timestamp: "2026-10-24T01:00:13.000Z",
      details: { empty: false },
    },
    {
      ...base,
      id: "11",
      sequence: 11,
      event: "evaluation_completed",
      timestamp: "2026-10-24T01:00:13.100Z",
      details: { method: "automatic", status: "correct" },
    },
    {
      ...base,
      id: "12",
      sequence: 12,
      event: "comparison_opened",
      timestamp: "2026-10-24T01:00:13.200Z",
    },
    {
      ...base,
      id: "13",
      sequence: 13,
      event: "comparison_slider_moved",
      timestamp: "2026-10-24T01:00:15.000Z",
      details: { from: 50, to: 20, via: "pointer" },
    },
    {
      ...base,
      id: "14",
      sequence: 14,
      event: "explanation_opened",
      timestamp: "2026-10-24T01:00:16.000Z",
    },
    {
      ...base,
      id: "15",
      sequence: 15,
      event: "observation_saved",
      timestamp: "2026-10-24T01:00:18.000Z",
    },
    {
      ...base,
      id: "16",
      sequence: 16,
      event: "session_completed",
      timestamp: "2026-10-24T01:00:21.000Z",
    },
  ];
  const result = analyzeStudy(events);
  expect(result.completionRate).toBe(1);
  expect(result.attempts[0]).toMatchObject({
    participantCode: "P-01",
    taskId: "goat",
    firstDrawingElapsedMs: 3000,
    drawingMs: 5000,
    submissions: 1,
    revisions: 2,
    hints: 1,
    attemptsToSuccess: 1,
    sliderUsed: true,
    sliderOperations: 1,
    explanationMs: 5000,
    completed: true,
  });

  const csv = studyCsv(events);
  expect(csv.startsWith("\ufeff")).toBe(true);
  expect(csv).toContain('"participantCode"');
  expect(csv).toContain('"P-01"');
  expect(csv).toContain('"comparison_slider_moved"');
});
