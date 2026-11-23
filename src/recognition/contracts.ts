export const speciesModelVersion =
  "bioclip-vit-b-16-int8/fa3c062ea31a6e1881b1977fe555b2d481dca730/kyoto-catalog-v2/photo-references-v2/roster-v1";
export type SpeciesRecognition = {
  speciesId: string | null;
  confidence: number;
  status: "identified" | "uncertain" | "unknown";
  modelVersion: string;
};
export type IndividualRecognition = {
  individualId: string | null;
  speciesId: string;
  confidence: number;
  status: "identified" | "uncertain" | "unknown";
  modelVersion: string;
};
