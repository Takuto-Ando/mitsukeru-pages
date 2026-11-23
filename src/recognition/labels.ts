import { kyotoCatalog } from "../content/kyotoCatalog";
import { adoptedAnimalById } from "../content/adoptedAnimals";
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
// Retain all model vectors as negatives so an excluded animal can still win
// and suppress a misleading suggestion from the 30 adoption groups.
export const speciesPrompts = [...catalogPrompts.keys()];
const byPrompt = new Map<string, Omit<Candidate, "score">>();
for (const [label, { groupId, speciesId }] of catalogPrompts) {
  const animal = adoptedAnimalById.get(speciesId ?? groupId);
  if (animal) byPrompt.set(label, { groupId: animal.id, speciesId });
}
export const recognitionThresholds = { minimum: 0.3, margin: 0.07 };
const reviewThresholds = { minimum: 0.12, rejectionMargin: 0.025 };

export function chooseCandidates(
  output: { label: string; score: number }[],
): Candidate[] {
  const valid = output
    .filter((o) => Number.isFinite(o.score) && o.score >= 0 && o.score <= 1)
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

type BioClipScore = { label: string; cosine: number };
type PhotoSimilarity = (
  speciesIds: readonly string[],
) => ReadonlyMap<string, number>;

const photoReferenceWeight = 0.6;
const candidateWindow = 0.065;
const photoReferenceMaximumGap = 0.026;
const photoReferenceMaximumTextConfidence = 0.78;

function reorderByPhoto(
  ranked: BioClipScore[],
  rejection: BioClipScore | undefined,
  similarity: PhotoSimilarity,
) {
  const [top] = ranked;
  const shortlist = ranked.flatMap((entry) => {
    const speciesId = byPrompt.get(entry.label)?.speciesId;
    if (
      !speciesId ||
      top.cosine - entry.cosine > candidateWindow ||
      (rejection && entry.cosine <= rejection.cosine)
    )
      return [];
    return [{ entry, speciesId }];
  });
  const runner = shortlist[1];
  if (!runner || top.cosine - runner.entry.cosine > photoReferenceMaximumGap)
    return ranked;
  const knownTotal = ranked.reduce(
    (total, { label, cosine }) =>
      byPrompt.has(label)
        ? total + Math.exp((cosine - top.cosine) * 100)
        : total,
    0,
  );
  if (1 / knownTotal > photoReferenceMaximumTextConfidence) return ranked;

  const visual = similarity(shortlist.map(({ speciesId }) => speciesId));
  const firstSpecies = shortlist[0].speciesId;
  if (!visual.has(firstSpecies)) return ranked;

  const combined = shortlist.flatMap(({ entry, speciesId }) => {
    const score = visual.get(speciesId);
    return score === undefined
      ? []
      : [{ entry, score: entry.cosine + photoReferenceWeight * score }];
  });
  combined.sort((a, b) => b.score - a.score);
  const winner = combined[0];
  if (!winner || winner.entry === top) return ranked;

  // Keep the original leading cosine and the background scores on their
  // existing scale. Only change the order of plausible known candidates.
  const updated = new Map(
    combined.map(({ entry, score }) => [
      entry,
      top.cosine - (winner.score - score),
    ]),
  );
  return ranked
    .map((entry) => ({
      ...entry,
      cosine: updated.get(entry) ?? entry.cosine,
    }))
    .sort((a, b) => b.cosine - a.cosine);
}

export function classifyBioClip(
  output: BioClipScore[],
  photoSimilarity?: PhotoSimilarity,
) {
  const ranked = output
    .filter(({ cosine }) => Number.isFinite(cosine))
    .sort((a, b) => b.cosine - a.cosine);
  const [top] = ranked;
  const rejection = ranked.find(({ label }) => !byPrompt.has(label));
  const candidates: Candidate[] = [];
  let confidenceMargin = 0;
  if (
    top &&
    byPrompt.has(top.label) &&
    top.cosine >= 0.24 &&
    top.cosine - (rejection?.cosine ?? 0) >= 0.008
  ) {
    const scores = photoSimilarity
      ? reorderByPhoto(ranked, rejection, photoSimilarity)
      : ranked;
    const [first] = scores;
    if (first.label === top.label) {
      const firstGroup = byPrompt.get(first.label)?.groupId;
      const second = scores.find(
        ({ label }) => byPrompt.get(label)?.groupId !== firstGroup,
      );
      confidenceMargin = first.cosine - (second?.cosine ?? 0);
    }
    const normalized = scores.map(({ cosine }) =>
      Math.exp((cosine - first.cosine) * 100),
    );
    const sum = normalized.reduce((total, value) => total + value, 0);
    const groups = new Map<string, Candidate>();
    for (const [index, entry] of scores.entries()) {
      if (first.cosine - entry.cosine > candidateWindow) break;
      const match = byPrompt.get(entry.label);
      if (!match || (rejection && entry.cosine <= rejection.cosine)) continue;
      const score = normalized[index] / sum;
      const group = groups.get(match.groupId);
      if (group) group.score += score;
      else groups.set(match.groupId, { ...match, score });
    }
    candidates.push(...[...groups.values()].slice(0, 3));
  }
  const best = candidates[0];
  return {
    candidates,
    recognition: {
      speciesId: best?.speciesId ?? null,
      confidence: best?.score ?? 0,
      status: !best
        ? ("unknown" as const)
        : confidenceMargin >= 0.04
          ? ("identified" as const)
          : ("uncertain" as const),
      modelVersion: speciesModelVersion,
    },
  };
}
