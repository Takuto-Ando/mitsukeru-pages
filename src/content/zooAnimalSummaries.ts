import summaries from "./zoo-animal-summaries.json";
import { kyotoCatalog, kyotoSpeciesById, zooSource } from "./kyotoCatalog";
import { adoptedAnimalById, adoptedAnimals } from "./adoptedAnimals";

const linesBySpecies: Record<string, readonly string[]> = summaries;
const zebraSource =
  "https://zoo.city.kyoto.lg.jp/zoo/enjoy/blog/crew-blog/20250516-80561.html";
const giraffeTongue = {
  text: "長い舌は枝から葉だけを食べるのに役立ちます。\n紫色は日差しから舌を守るための色です。",
  source: "https://zoo.city.kyoto.lg.jp/zoo/uploads/image/anone758.pdf",
};

function summarySpeciesId(id?: string, taskId?: string) {
  return id === "goat" && taskId === "sheep" ? "sheep" : id;
}

export function zooAnimalSummary(id?: string, taskId?: string) {
  if (id === "giraffe" && taskId === "giraffe") return giraffeTongue.text;
  const adopted = id ? adoptedAnimalById.get(id) : undefined;
  if (adopted) return adopted.description;
  const speciesId = summarySpeciesId(id, taskId);
  if (!speciesId || !Object.hasOwn(linesBySpecies, speciesId)) return undefined;
  return linesBySpecies[speciesId].join("\n");
}

export function zooAnimalSummarySource(id: string, taskId?: string) {
  if (id === "giraffe" && taskId === "giraffe") return giraffeTongue.source;
  if (id === "zebra") return zebraSource;
  const speciesId = summarySpeciesId(id, taskId);
  const entry = speciesId && kyotoSpeciesById.get(speciesId);
  return entry ? zooSource(entry.slug) : undefined;
}

const previousNames: Record<string, string> = {
  ツキノワグマ: "bear",
  ニホンジカ: "deer",
  "ヤギ・ヒツジ": "goat",
  シマウマ: "zebra",
};

export function zooAnimalIdByName(name?: string) {
  if (!name) return undefined;
  return (
    adoptedAnimals.find((entry) => entry.name === name)?.id ??
    kyotoCatalog.find((entry) => entry.name === name)?.id ??
    (Object.hasOwn(previousNames, name) ? previousNames[name] : undefined)
  );
}
