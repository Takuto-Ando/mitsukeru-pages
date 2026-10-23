export interface Animal {
  id: string;
  name: string;
  scientificName: string;
  zooStatus: "verified" | "unverified";
  sourceStatus: "verified" | "unverified";
  zooSource: string;
}
export const scope = {
  expectedSpeciesCount: 30,
  officialRosterStatus: "awaiting-source" as const,
  note: "16グループは画像から判読した暫定リストです。提供資料の正式な全30カードとの一致は未確認です。",
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
