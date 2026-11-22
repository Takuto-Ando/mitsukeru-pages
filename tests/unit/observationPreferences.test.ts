import { describe, expect, it } from "vitest";
import { difficultyForTask } from "../../src/content/taskDifficulty";
import {
  observationTaskFor,
  preferencesForAge,
  type ObservationPreferences,
} from "../../src/replica/preferences";

describe("観察設定", () => {
  const initial: ObservationPreferences = {
    furigana: true,
    deviceSaveEnabled: false,
  };

  it.each([
    [10, true, 1],
    [11, false, 2],
    [17, false, 2],
    [18, false, 3],
  ])("%i歳のふりがなと難易度を設定する", (age, furigana, difficulty) => {
    expect(preferencesForAge(initial, age)).toEqual({
      age,
      furigana,
      difficulty,
      deviceSaveEnabled: false,
    });
  });

  it("既存の観察課題から難易度を選ぶ", () => {
    expect(observationTaskFor("giraffe")?.id).toBe("giraffe");
    expect(observationTaskFor("giraffe", 1)?.id).toBe("giraffe");
    expect(observationTaskFor("giraffe", 2)?.id).toBe("giraffe-hoof");
    const hard = observationTaskFor("giraffe", 3);
    expect(hard?.id).toBe("giraffe-horns");
    expect(difficultyForTask(hard?.id, hard?.scene.regions.length ?? 0)).toBe(
      3,
    );
  });

  it("指定済みの種を維持し、同じ難易度がなければ最も近い課題を選ぶ", () => {
    expect(observationTaskFor("goat", 3, "sheep")?.id).toBe("sheep");
    expect(observationTaskFor("gibbon", 3)?.id).toBe("gibbon");
    expect(observationTaskFor("gibbon", 1)?.id).toBe("gibbon-face");
    expect(observationTaskFor("giraffe", 3, "sheep")?.id).toBe("giraffe-horns");
  });
});
