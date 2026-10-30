export interface Animal {
  id: string;
  name: string;
  scientificName: string;
  zooStatus: "verified" | "unverified";
  sourceStatus: "verified" | "unverified";
  zooSource: string;
}
export const scope = {
  expectedSpeciesCount: 21,
  expectedCardCount: 30,
  groupCount: 20,
  officialRosterStatus: "source-reviewed" as const,
  note: "提供PDFの全30カードを20グループとして確認。ヒツジを含めた種の選択先は21です。",
};
export const animals: Animal[] = [
  {
    id: "goat",
    name: "ヤギ",
    scientificName: "Capra hircus",
    zooStatus: "verified",
    sourceStatus: "unverified",
    zooSource: "https://zoo.city.kyoto.lg.jp/zoo/animals/c_aegagrus",
  },
];
export const verifiedSourceAnimals = () =>
  animals.filter((animal) => animal.sourceStatus === "verified");
