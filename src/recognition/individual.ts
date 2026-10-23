// Individual identity is independent of species classification; no biometric model is installed.
export interface IndividualRecognizer {
  identify(
    photo: string,
    speciesId: string,
  ): Promise<
    { status: "unsupported" } | { status: "identified"; individualId: string }
  >;
}
export const individualRecognizer: IndividualRecognizer = {
  async identify() {
    return { status: "unsupported" };
  },
};
