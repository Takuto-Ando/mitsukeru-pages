import { kyotoCatalog } from "../content/kyotoCatalog";
import { adoptedAnimalById } from "../content/adoptedAnimals";
import { speciesModelVersion } from "./contracts";
import { nonAnimalRejections } from "./rosterClassifier";
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
// Original bank prompts for the archived bank generator.
export const rejectionLabels = [
  "a person",
  "a dog",
  "a domestic cat",
  "a tiger",
  "a lion",
  "an empty zoo enclosure",
  "a landscape without animals",
  "a blurry photograph",
  "cage bars",
  "a zoo information board",
  "pebbles on the ground",
  "grass and leaves",
  "a rabbit hutch",
  "a domestic chicken",
  "a black crow",
  "a rock pigeon",
];
export type Candidate = { groupId: string; score: number; speciesId?: string };
const confirmedPromptIds = new Set(
  animalLabels.map(([id, label]): string =>
    label === "a sheep" ? "sheep" : id,
  ),
);
const catalogPrompts = new Map<string, Omit<Candidate, "score">>();
for (const [groupId, label] of animalLabels) {
  catalogPrompts.set(label, {
    groupId,
    speciesId: label === "a sheep" ? "sheep" : groupId,
  });
}
for (const entry of kyotoCatalog) {
  if (entry.prompt) {
    catalogPrompts.set(entry.prompt, {
      groupId: entry.groupId,
      speciesId: entry.id,
    });
  }
}
const byPrompt = new Map<string, Omit<Candidate, "score">>();
for (const [label, { groupId, speciesId }] of catalogPrompts) {
  const animal = adoptedAnimalById.get(speciesId ?? groupId);
  if (animal) byPrompt.set(label, { groupId: animal.id, speciesId });
}
export const speciesPrompts = [...byPrompt.keys()];
const nonAnimalLabels = new Set<string>(nonAnimalRejections);
export const recognitionThresholds = { minimum: 0.3, margin: 0.07 };
const reviewThresholds = { minimum: 0.12, rejectionMargin: 0.025 };

export function chooseCandidates(
  output: { label: string; score: number }[],
): Candidate[] {
  const valid = output
    .filter(
      ({ label, score }) =>
        (byPrompt.has(label) || nonAnimalLabels.has(label)) &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= 1,
    )
    .sort((a, b) => b.score - a.score);
  const [top] = valid;
  const match = top && byPrompt.get(top.label);
  if (!match) return [];

  const isLegacy = confirmedPromptIds.has(match.speciesId ?? match.groupId);
  const minimum = isLegacy
    ? recognitionThresholds.minimum
    : reviewThresholds.minimum;
  const runner = isLegacy
    ? valid.find(
        (item) => byPrompt.get(item.label)?.speciesId !== match.speciesId,
      )
    : valid.find((item) => !byPrompt.has(item.label));
  const margin = isLegacy
    ? recognitionThresholds.margin
    : reviewThresholds.rejectionMargin;
  if (top.score < minimum || top.score - (runner?.score ?? 0) < margin)
    return [];

  const candidates = new Map<string, Candidate>();
  for (const { label, score } of valid) {
    const choice = byPrompt.get(label);
    if (!choice || score < 0.08) continue;
    const key = choice.speciesId ?? choice.groupId;
    if (!candidates.has(key)) candidates.set(key, { ...choice, score });
    if (candidates.size === 3) break;
  }
  return [...candidates.values()];
}

export function canAutoSelect(first?: Candidate, second?: Candidate) {
  return Boolean(
    first &&
    confirmedPromptIds.has(first.speciesId ?? first.groupId) &&
    first.score >= 0.55 &&
    first.score - (second?.score ?? 0) >= 0.12,
  );
}

export function recognitionFromOutput(
  output: { label: string; score: number }[],
) {
  const [top, second] = chooseCandidates(output);
  return {
    speciesId: top?.speciesId ?? null,
    confidence: top?.score ?? 0,
    status: !top
      ? ("unknown" as const)
      : canAutoSelect(top, second)
        ? ("identified" as const)
        : ("uncertain" as const),
    modelVersion: speciesModelVersion,
  };
}
