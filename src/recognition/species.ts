// A model must return a supported group ID; never guess from an unavailable model.
export type SpeciesResult =
  | { status: "unsupported"; reason: string }
  | { status: "recognized"; groupId: string };
export interface SpeciesRecognizer {
  recognize(photo: string): Promise<SpeciesResult>;
}
export const speciesRecognizer: SpeciesRecognizer = {
  async recognize() {
    return {
      status: "unsupported",
      reason:
        "動物を識別できるモデルは未導入です。写真の動物を選んでください。",
    };
  },
};
