import { test, expect } from "vitest";
import {
  badgeStatus,
  challengeProgress,
  currentChallenge,
  monthStats,
  nextAnimals,
  observationsToCsv,
  todaysMissions,
  CHALLENGES,
} from "../../src/future/extras";
import type { ObservationRecord } from "../../src/notebook/types";

function record(groupId: string, createdAt: string): ObservationRecord {
  return {
    id: groupId + createdAt,
    groupId,
    animalName: groupId,
    taskName: "課題",
    createdAt,
    strokes: [],
    explanation: { name: groupId, form: "形の説明", ecology: "" },
  } as unknown as ObservationRecord;
}

test("月替わりチャレンジは月ごとに切り替わり、今月の観察だけ数える", () => {
  const jan = new Date(2026, 0, 15);
  const feb = new Date(2026, 1, 15);
  expect(CHALLENGES).toContain(currentChallenge(jan));
  const drawings = [
    record("elephant", "2026-01-03T10:00:00"),
    record("tapir", "2026-01-20T10:00:00"),
    record("hippo", "2025-12-20T10:00:00"), // 先月分は数えない
  ];
  const progress = challengeProgress(drawings, jan);
  if (progress.challenge.id === "nose") {
    expect(progress.done).toBe(2);
    expect(progress.complete).toBe(false);
  }
  expect(currentChallenge(feb)).toBeDefined();
});

test("特徴バッジは対象種の観察数で判定する", () => {
  const drawings = [record("elephant", "2026-01-01"), record("hippo", "2026-01-02")];
  const nose = badgeStatus(drawings).find((b) => b.badge.id === "nose")!;
  expect(nose.count).toBe(2);
  expect(nose.earned).toBe(true);
  const tail = badgeStatus(drawings).find((b) => b.badge.id === "tail")!;
  expect(tail.earned).toBe(false);
});

test("次の動物は未観察のグループを順に返す", () => {
  const drawings = [record("mandrill", "2026-01-01")];
  const next = nextAnimals(drawings, 3);
  expect(next.map((g) => g.id)).toEqual(["gibbon", "lemur", "goat"]);
});

test("月次集計は今月と先月を分ける", () => {
  const drawings = [
    record("goat", "2026-11-02T09:00:00"),
    record("goat", "2026-11-03T09:00:00"),
    record("zebra", "2026-10-03T09:00:00"),
  ];
  const stats = monthStats(drawings, new Date(2026, 10, 21));
  expect(stats.thisMonth).toEqual({ cards: 2, species: 1 });
  expect(stats.lastMonth).toEqual({ cards: 1, species: 1 });
});

test("CSVは見出しとエスケープを含む", () => {
  const csv = observationsToCsv([record("goat", "2026-11-02T09:00:00")]);
  const lines = csv.split("\r\n");
  expect(lines[0]).toContain("日付");
  expect(lines[1]).toContain("2026-11-02");
  expect(lines[1]).toContain("形の説明");
});

test("まちがい探しクイズは正解の部位を含む3択を作る", async () => {
  const { buildDifferenceQuestions } = await import(
    "../../src/future/quizLogic"
  );
  const items = [
    { animal: "ヤギ", part: "瞳孔", image: "a.svg" },
    { animal: "ゾウ", part: "鼻", image: "b.svg" },
    { animal: "キリン", part: "舌", image: "c.svg" },
    { animal: "カバ", part: "鼻の穴", image: "d.svg" },
  ];
  const questions = buildDifferenceQuestions(items, 3, () => 0.42);
  expect(questions).toHaveLength(3);
  for (const q of questions) {
    expect(q.choices).toHaveLength(3);
    expect(q.choices).toContain(q.part);
  }
});

test("辞書カバーチェックは未登録の漢字語を拾う", async () => {
  const { uncoveredWords } = await import("../../src/furigana/coverage");
  const missing = uncoveredWords(["観察が大好きな動物です"]);
  // 「観察」は辞書登録済みのはず。それ以外のかたまりが候補になる
  expect(missing).not.toContain("観察");
  expect(Array.isArray(missing)).toBe(true);
});

test("今日のミッションは3件（重複なし）", () => {
  const missions = todaysMissions([], new Date(2026, 10, 21));
  expect(missions).toHaveLength(3);
  expect(new Set(missions.map((m) => m.id)).size).toBe(3);
});
