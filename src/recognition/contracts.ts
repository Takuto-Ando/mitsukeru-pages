export const speciesModelVersion =
  "bioclip-vit-b-16-int8/fa3c062ea31a6e1881b1977fe555b2d481dca730/roster-30-text-v2/photo-references-v2/review-suggestions-v1";
export type PhotoReferenceSuggestion = {
  groupId: string;
  similarity: number;
  clear: boolean;
};
export type SpeciesRecognition = {
  speciesId: string | null;
  confidence: number;
  status: "identified" | "uncertain" | "unknown";
  modelVersion: string;
  cameraEvidence?: {
    groupId: string;
    similarity: number;
    lead: number;
    referenceAgrees: boolean;
  };
};
export type IndividualRecognition = {
  individualId: string | null;
  speciesId: string;
  confidence: number;
  status: "identified" | "uncertain" | "unknown";
  modelVersion: string;
};
