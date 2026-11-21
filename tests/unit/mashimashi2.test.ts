import { describe, expect, it } from "vitest";
import { parseTaskHash, taskHash } from "../../src/future/deeplink";
import { COURSES, courseProgress } from "../../src/future/courses";
import { KNOWLEDGE } from "../../src/future/knowledge";
import { groups } from "../../src/content/groups";
import type { ObservationRecord } from "../../src/notebook/types";

function record(groupId: string): ObservationRecord {
  return {
    id: groupId,
    groupId,
    createdAt: "2026-11-21T10:00:00.000Z",
    strokes: [],
    animalName: groupId,
    taskName: "t",
    explanation: { name: "n", form: "f", ecology: "e" },
    question: "q",
    sceneSnapshot: {
      version: 1,
      sceneKey: "k",
      completed: true,
      completedAt: "",
      strokes: [],
    },
  } as ObservationRecord;
}

describe("deeplink", () => {
  it("round-trips a task id through the hash", () => {
    expect(parseTaskHash(taskHash("giraffe-tongue"))).toBe("giraffe-tongue");
    expect(parseTaskHash("#other")).toBeNull();
    expect(parseTaskHash("")).toBeNull();
  });
});

describe("courses", () => {
  it("tracks progress and next step", () => {
    const eyes = COURSES[0];
    const none = courseProgress(eyes, []);
    expect(none.nextId).toBe(eyes.groupIds[0]);
    const partial = courseProgress(eyes, [record(eyes.groupIds[0])]);
    expect(partial.doneIds).toHaveLength(1);
    expect(partial.nextId).toBe(eyes.groupIds[1]);
    const all = courseProgress(
      eyes,
      eyes.groupIds.map((id) => record(id)),
    );
    expect(all.complete).toBe(true);
  });
});

describe("knowledge", () => {
  it("covers every animal group with food, night and keeper notes", () => {
    for (const g of groups) {
      const k = KNOWLEDGE[g.id];
      expect(k, g.id).toBeDefined();
      expect(k.food.length).toBeGreaterThan(0);
      expect(k.night.length).toBeGreaterThan(0);
      expect(k.keeper.length).toBeGreaterThan(0);
    }
  });
});
