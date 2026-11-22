export type Difficulty = 1 | 2 | 3;

// A single drawing region can contain multiple distinct features that must
// be observed separately. Keep these catalog levels consistent with the badges.
const taskLevels: Partial<Record<string, Difficulty>> = {
  "giraffe-hoof": 2,
  "giraffe-lashes": 2,
  "giraffe-horns": 3,
  "zebra-lashes": 2,
  "lemur-tail": 3,
  "meerkat-claws": 3,
};

export function difficultyForTask(
  taskId: string | undefined,
  regionCount: number,
) {
  return (taskId ? taskLevels[taskId] : undefined) ?? Math.min(3, regionCount);
}
