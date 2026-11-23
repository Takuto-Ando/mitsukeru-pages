const dimensions = 512;

type PhotoReferenceBank = {
  speciesIds: string[];
  vectors: string;
};

export function createPhotoReferenceMatcher(bank: PhotoReferenceBank) {
  const references = new Map<string, { vector: Int8Array; norm: number }[]>();
  try {
    const vectors = Int8Array.from(atob(bank.vectors), (value) =>
      value.charCodeAt(0),
    );
    if (vectors.length !== bank.speciesIds.length * dimensions)
      return undefined;

    for (const [index, speciesId] of bank.speciesIds.entries()) {
      const vector = vectors.subarray(
        index * dimensions,
        (index + 1) * dimensions,
      );
      const norm = Math.sqrt(
        vector.reduce((total, value) => total + value * value, 0),
      );
      if (!norm) continue;
      const group = references.get(speciesId) ?? [];
      group.push({ vector, norm });
      references.set(speciesId, group);
    }
  } catch {
    // Photo references are optional. Keep text-based recognition usable.
    return undefined;
  }

  return (features: Float32Array, speciesIds: readonly string[]) => {
    const scores = new Map<string, number>();
    if (features.length !== dimensions) return scores;
    const featureNorm = Math.sqrt(
      features.reduce((total, value) => total + value * value, 0),
    );
    if (!Number.isFinite(featureNorm) || !featureNorm) return scores;

    for (const speciesId of speciesIds) {
      const templates = references.get(speciesId);
      if (!templates) continue;
      let best = -Infinity;
      for (const { vector, norm } of templates) {
        let dot = 0;
        for (let index = 0; index < dimensions; index++)
          dot += features[index] * vector[index];
        best = Math.max(best, dot / (norm * featureNorm));
      }
      scores.set(speciesId, best);
    }
    return scores;
  };
}
