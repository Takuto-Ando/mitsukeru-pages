import rows from "./kyoto-catalog.json" with { type: "json" };

export const kyotoCatalog = rows;
export const kyotoDrafts = rows.filter((entry) => entry.draft !== undefined);
export const kyotoSpeciesById = new Map(rows.map((entry) => [entry.id, entry]));
export const zooSource = (slug: string) =>
  `https://zoo.city.kyoto.lg.jp/zoo/animals/${slug}`;
