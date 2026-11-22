import { loadFurigana, saveFurigana } from "../furigana/Furigana";
import { taskById, tasksForGroup } from "../content/tasks";
import { difficultyForTask, type Difficulty } from "../content/taskDifficulty";

export type { Difficulty } from "../content/taskDifficulty";

export type ObservationPreferences = {
  age?: number;
  furigana: boolean;
  difficulty?: Difficulty;
  deviceSaveEnabled: boolean;
};

export const maximumAge = 120;
const preferencesKey = "zooketch-observation-preferences-v1";

function isAge(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximumAge
  );
}

export function loadObservationPreferences(): ObservationPreferences {
  const furigana = loadFurigana();
  try {
    const stored = JSON.parse(
      localStorage.getItem(preferencesKey) ?? "{}",
    ) as Partial<ObservationPreferences> | null;
    const difficulty = stored?.difficulty;
    return {
      age: isAge(stored?.age) ? stored.age : undefined,
      furigana,
      difficulty:
        difficulty === 1 || difficulty === 2 || difficulty === 3
          ? difficulty
          : undefined,
      deviceSaveEnabled: stored?.deviceSaveEnabled !== false,
    };
  } catch {
    return { furigana, deviceSaveEnabled: true };
  }
}

export function saveObservationPreferences(
  preferences: ObservationPreferences,
) {
  const { furigana, ...stored } = preferences;
  saveFurigana(furigana);
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(stored));
  } catch {
    // The selected settings still apply to the open app.
  }
}

export function preferencesForAge(
  preferences: ObservationPreferences,
  age: number,
): ObservationPreferences {
  return {
    ...preferences,
    age,
    furigana: age <= 10,
    difficulty: age <= 10 ? 1 : age < 18 ? 2 : 3,
  };
}

export function observationTaskFor(
  groupId: string,
  difficulty?: Difficulty,
  identifiedTaskId?: string,
) {
  const identified = identifiedTaskId && taskById[identifiedTaskId];
  if (identified && identified.groupId === groupId) return identified;

  const choices = tasksForGroup(groupId);
  if (!difficulty) return choices[0];
  const distance = (task: (typeof choices)[number]) =>
    Math.abs(
      difficultyForTask(task.id, task.scene.regions.length) - difficulty,
    );
  return choices.reduce<(typeof choices)[number] | undefined>(
    (best, task) => (!best || distance(task) < distance(best) ? task : best),
    undefined,
  );
}
