import { adoptedAnimals } from "../content/adoptedAnimals";
import type { createPhotoReferenceMatcher } from "./photoReferenceMatcher";

const speciesByGroup = new Map(
  adoptedAnimals.map(({ id, aliases }) => [id, [id, ...(aliases ?? [])]]),
);

export function groupPhotoReferences(
  match: NonNullable<ReturnType<typeof createPhotoReferenceMatcher>>,
  feature: Float32Array,
  groupIds: readonly string[],
): ReadonlyMap<string, number> {
  const speciesIds = groupIds.flatMap((id) => speciesByGroup.get(id) ?? []);
  const speciesScores = match(feature, speciesIds);
  const groupScores = new Map<string, number>();
  for (const id of groupIds) {
    let best = -Infinity;
    for (const speciesId of speciesByGroup.get(id) ?? [])
      best = Math.max(best, speciesScores.get(speciesId) ?? -Infinity);
    if (Number.isFinite(best)) groupScores.set(id, best);
  }
  return groupScores;
}
