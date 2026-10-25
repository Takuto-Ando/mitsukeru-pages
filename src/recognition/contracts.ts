export const speciesModelVersion =
  "clip-vit-base-patch32-q8/d15189d7028b43f1d3e65039190477f6af591c2a/labels-v2";
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
