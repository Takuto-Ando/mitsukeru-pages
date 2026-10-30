import { test, expect } from "vitest";
import { drawingEvaluator, challengeProvider } from "../../src/domain";
import { tasks, taskById } from "../../src/content/tasks";
import { recognitionFromOutput } from "../../src/recognition/labels";
import { analyzeStudy } from "../../src/research/analysis";
import type { StudyEvent } from "../../src/research/study";
import { japaneseVoice } from "../../src/speech/Speech";
for (const task of tasks)
  test(`${task.id}: 空白を自動正解にせず判定または自己比較へ`, () => {
    const empty = drawingEvaluator.evaluate(task, []);
    expect(empty.status).toBe("uncertain");
    expect(empty.passed).toBe(false);
    const r = task.scene.regions[0],
      h = task.scene.frameHeight || 400;
    const line = [
      { x: (r.x + 0.02 * r.width) * 600, y: (r.y + 0.2 * r.height) * h },
      { x: (r.x + 0.8 * r.width) * 600, y: (r.y + 0.6 * r.height) * h },
    ];
    const answer = drawingEvaluator.evaluate(task, [line]);
    expect(answer.challengeId).toBe(task.id);
    if (!task.automatic) {
      expect(answer.status).toBe("uncertain");
      expect(answer.method).toBe("comparison");
    }
  });
test("羊を種として区別し、対象外・曖昧な推定は確定しない", () => {
  expect(challengeProvider.forSpecies("sheep")[0].id).toBe("sheep");
  expect(taskById.sheep.automatic).toBe(true);
  expect(
    recognitionFromOutput([{ label: "a sheep", score: 0.9 }]),
  ).toMatchObject({ speciesId: "sheep", status: "identified" });
  expect(recognitionFromOutput([{ label: "a dog", score: 0.9 }])).toMatchObject(
    { speciesId: null, status: "unknown" },
  );
  expect(
    recognitionFromOutput([
      { label: "a goat", score: 0.35 },
      { label: "a donkey", score: 0.34 },
    ]).status,
  ).toBe("unknown");
  expect(challengeProvider.forSpecies("bush-dog")[0].id).toBe("bush-dog");
});
test("研究記録の終了だけでは課題を完了したことにしない", () => {
  const base = {
    sessionId: "s",
    taskId: "goat",
    attemptId: "a",
    id: "1",
    sequence: 1,
    timestamp: "2026-10-24T00:00:00Z",
  };
  const events: StudyEvent[] = [
    { ...base, event: "challenge_opened" },
    {
      ...base,
      id: "2",
      sequence: 2,
      timestamp: "2026-10-24T00:00:10Z",
      event: "session_completed",
    },
  ];
  expect(analyzeStudy(events).completionRate).toBe(0);
});
test("日本語音声だけを選択し、非対応なら未選択", () => {
  expect(
    japaneseVoice([
      { lang: "en-US" },
      { lang: "ja-JP" },
    ] as SpeechSynthesisVoice[])?.lang,
  ).toBe("ja-JP");
  expect(
    japaneseVoice([{ lang: "en-US" }] as SpeechSynthesisVoice[]),
  ).toBeUndefined();
});

test("オフラインAIでも撮影画像のdata URLを遮断しない", async () => {
  const { remoteWhileOffline } =
    await import("../../src/recognition/cachePolicy");
  expect(
    remoteWhileOffline(
      "data:image/png;base64,test",
      "https://example.org",
      false,
    ),
  ).toBe(false);
  expect(
    remoteWhileOffline(
      "blob:https://example.org/test",
      "https://example.org",
      false,
    ),
  ).toBe(false);
  expect(
    remoteWhileOffline(
      "https://example.org/assets/runtime.wasm",
      "https://example.org",
      false,
    ),
  ).toBe(false);
  expect(
    remoteWhileOffline(
      "https://huggingface.co/model/config.json",
      "https://example.org",
      false,
    ),
  ).toBe(true);
});
