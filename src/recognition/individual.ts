import type { IndividualRecognition } from "./contracts";
export interface IndividualRecognizer {
  identify(
    photo: string,
    speciesId: string,
  ): Promise<IndividualRecognition & { supported: boolean }>;
}
// Deliberately no model: unknown is never a fabricated individual identity.
export const individualRecognizer: IndividualRecognizer = {
  async identify(_photo, speciesId) {
    return {
      individualId: null,
      speciesId,
      confidence: 0,
      status: "unknown",
      modelVersion: "none",
      supported: false,
    };
  },
};
