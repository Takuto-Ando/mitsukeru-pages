import { adoptedAnimals } from "../content/adoptedAnimals";
import {
  speciesModelVersion,
  type PhotoReferenceSuggestion,
} from "./contracts";
import type { Candidate } from "./labels";

export const nonAnimalRejections = [
  "a person",
  "an empty zoo enclosure",
  "a landscape without animals",
  "a blurry photograph",
  "cage bars",
  "a zoo information board",
  "pebbles on the ground",
  "grass and leaves",
  "a rabbit hutch",
] as const;

const rejectedLabels = new Set<string>(nonAnimalRejections);
const referenceGroupIds = adoptedAnimals.map(({ id }) => id);
const rosterIds = new Set(referenceGroupIds);
type Score = { label: string; cosine: number };
type MatchPhoto = (
  speciesIds: readonly string[],
) => ReadonlyMap<string, number>;
type Policy = {
  minimum: number;
  autoMargin: number;
  referenceWeight: number;
  referenceGap: number;
  candidateMargin: number;
  allowReferenceSuggestion: boolean;
};
const defaults: Policy = {
  minimum: 0.26,
  autoMargin: 0.04,
  referenceWeight: 0.6,
  referenceGap: 0.04,
  candidateMargin: 0,
  allowReferenceSuggestion: false,
};
const candidateWindow = 0.065;
const rejectionMargin = 0.008;
const temperature = 100;

function photoReferenceSuggestion(
  known: Score[],
  rejection: number,
  match: MatchPhoto,
): PhotoReferenceSuggestion | undefined {
  const [top] = known;
  const minimum = Math.max(0.2, rejection + 0.012);
  if (!top || top.cosine < minimum) return;

  const referenceScores = [...match(referenceGroupIds)]
    .filter(([id, score]) => rosterIds.has(id) && Number.isFinite(score))
    .sort((a, b) => b[1] - a[1]);
  const [best, runner] = referenceScores;
  if (!best || !runner) return;
  const [groupId, similarity] = best;
  const referenceMargin = similarity - runner[1];
  if (similarity < 0.4 || referenceMargin < 0.03) return;

  const text = known.find(({ label }) => label === groupId);
  if (!text || text.cosine < minimum || top.cosine - text.cosine > 0.055)
    return;
  return {
    groupId,
    similarity,
    clear:
      groupId === top.label &&
      top.cosine >= 0.22 &&
      similarity >= 0.5 &&
      referenceMargin >= 0.07,
  };
}

function rerank(
  known: Score[],
  rejection: number,
  match: MatchPhoto,
  policy: Policy,
) {
  const [first, second] = known;
  if (
    !second ||
    !policy.referenceWeight ||
    first.cosine - second.cosine > policy.referenceGap
  )
    return known;
  const textTotal = known.reduce(
    (sum, { cosine }) => sum + Math.exp((cosine - first.cosine) * temperature),
    0,
  );
  if (policy.referenceGap <= 0.026 && 1 / textTotal > 0.78) return known;

  const shortlist = known.filter(
    ({ cosine }) =>
      first.cosine - cosine <= candidateWindow && cosine > rejection,
  );
  const scores = match(shortlist.map(({ label }) => label));
  if (!scores.has(first.label)) return known;

  const combined = shortlist
    .flatMap(({ label, cosine }) => {
      const score = scores.get(label);
      return score === undefined
        ? []
        : [{ label, cosine: cosine + policy.referenceWeight * score }];
    })
    .sort((a, b) => b.cosine - a.cosine);
  const winner = combined[0];
  if (!winner || winner.label === first.label) return known;

  const updated = new Map(
    combined.map(({ label, cosine }) => [
      label,
      first.cosine - (winner.cosine - cosine),
    ]),
  );
  const revised = known
    .map(({ label, cosine }) => ({
      label,
      cosine: updated.get(label) ?? cosine,
    }))
    .sort((a, b) => b.cosine - a.cosine);
  return revised;
}

export function classifyRosterBioClip(
  output: Score[],
  matchPhoto?: MatchPhoto,
  settings?: Partial<Policy>,
) {
  const policy = settings ? { ...defaults, ...settings } : defaults;
  const known: Score[] = [];
  let rejection = -Infinity;
  for (const score of output) {
    if (!Number.isFinite(score.cosine)) continue;
    if (rosterIds.has(score.label)) known.push(score);
    else if (rejectedLabels.has(score.label))
      rejection = Math.max(rejection, score.cosine);
  }
  known.sort((a, b) => b.cosine - a.cosine);
  const [top] = known;
  const candidates: Candidate[] = [];
  let identified = false;
  if (
    top &&
    top.cosine >= policy.minimum &&
    top.cosine - rejection >= rejectionMargin
  ) {
    const ranked = matchPhoto
      ? rerank(known, rejection, matchPhoto, policy)
      : known;
    const [first, second] = ranked;
    identified =
      first.label === top.label &&
      first.cosine - Math.max(second?.cosine ?? -Infinity, rejection) >=
        policy.autoMargin;
    const lead = first.cosine - (second?.cosine ?? -Infinity);
    const scores = ranked.map(({ cosine }) =>
      Math.exp((cosine - first.cosine) * temperature),
    );
    const total = scores.reduce((sum, score) => sum + score, 0);
    for (const [index, { label, cosine }] of ranked.entries()) {
      if (lead < policy.candidateMargin) break;
      if (first.cosine - cosine > candidateWindow || cosine <= rejection) break;
      candidates.push({
        groupId: label,
        speciesId: label,
        score: scores[index] / total,
      });
      if (candidates.length === 3) break;
    }
  }
  const best = candidates[0];
  return {
    candidates,
    referenceSuggestion:
      !best && matchPhoto && policy.allowReferenceSuggestion
        ? photoReferenceSuggestion(known, rejection, matchPhoto)
        : undefined,
    recognition: {
      speciesId: best?.speciesId ?? null,
      confidence: best?.score ?? 0,
      status: !best
        ? ("unknown" as const)
        : identified
          ? ("identified" as const)
          : ("uncertain" as const),
      modelVersion: speciesModelVersion,
    },
  };
}
