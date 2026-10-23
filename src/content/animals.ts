export interface Animal {
  id: string;
  name: string;
  scientificName: string;
  zooStatus: "verified" | "unverified";
  mikecaStatus: "verified" | "unverified";
  zooSource: string;
}
export const scope = {
  expectedSpeciesCount: 30,
  officialRosterStatus: "awaiting-source" as const,
  note: "16グループは画像から判読した暫定リストです。MIKECAの正式な全30カードとの一致は未確認です。",
};
export const animals: Animal[] = [
  {
    id: "goat",
    name: "ヤギ",
    scientificName: "Capra hircus",
    zooStatus: "verified",
    mikecaStatus: "unverified",
    zooSource: "https://zoo.city.kyoto.lg.jp/zoo/animals/c_aegagrus",
  },
];
export const verifiedMikecaAnimals = () =>
  animals.filter((animal) => animal.mikecaStatus === "verified");
