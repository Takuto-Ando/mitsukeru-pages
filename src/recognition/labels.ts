import { speciesModelVersion } from "./contracts";
export const animalLabels = [
  ["mandrill", "a mandrill monkey"],
  ["gibbon", "a white-handed gibbon"],
  ["lemur", "a ring-tailed lemur"],
  ["bush-dog", "a bush dog Speothos venaticus"],
  ["goat", "a goat"],
  ["goat", "a sheep"],
  ["elephant", "an Asian elephant"],
  ["capuchin", "a tufted capuchin monkey"],
  ["macaque", "a rhesus macaque"],
  ["badger", "a Japanese badger"],
  ["zebra", "a zebra"],
  ["giraffe", "a giraffe"],
  ["hippo", "a hippopotamus"],
  ["fennec", "a fennec fox"],
  ["gorilla", "a western gorilla"],
  ["donkey", "a donkey"],
  ["meerkat", "a meerkat"],
  ["deer", "a sika deer"],
] as const;
export const rejectionLabels = [
  "a person",
  "a dog",
  "a cat",
  "a bird",
  "a tiger",
  "a lion",
  "an empty zoo enclosure",
  "a landscape with no animal",
  "an unclear blurry photograph",
];
export type Candidate = { groupId: string; score: number; speciesId?: string };
export const recognitionThresholds = { minimum: 0.3, margin: 0.07 };
export function chooseCandidates(
  output: { label: string; score: number }[],
): Candidate[] {
  const valid = output
    .filter((o) => Number.isFinite(o.score) && o.score >= 0 && o.score <= 1)
    .sort((a, b) => b.score - a.score);
  const top = valid[0];
  if (!top) return [];
  const labelMap = new Map<string, string>(
    animalLabels.map(([id, label]) => [label, id]),
  );
  const id = labelMap.get(top.label);
  if (!id || top.score < recognitionThresholds.minimum) return [];
  const next = valid.find((v) => labelMap.get(v.label) !== id);
  if (top.score - (next?.score || 0) < recognitionThresholds.margin) return [];
  const byGroup = new Map<string, number>();
  for (const item of valid) {
    const group = labelMap.get(item.label);
    if (group)
      byGroup.set(group, Math.max(byGroup.get(group) || 0, item.score));
  }
  return [...byGroup]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([, score]) => score >= 0.08)
    .map(([groupId, score]) => ({
      groupId,
      score,
      speciesId:
        groupId === "goat" &&
        valid.find((v) => labelMap.get(v.label) === groupId)?.label ===
          "a sheep"
          ? "sheep"
          : groupId,
    }));
}

export function recognitionFromOutput(
  output: { label: string; score: number }[],
) {
  const candidates = chooseCandidates(output),
    top = candidates[0];
  return {
    speciesId: top?.speciesId || null,
    confidence: top?.score || 0,
    status: !top
      ? ("unknown" as const)
      : top.score >= 0.55 && top.score - (candidates[1]?.score || 0) >= 0.12
        ? ("identified" as const)
        : ("uncertain" as const),
    modelVersion: speciesModelVersion,
  };
}
