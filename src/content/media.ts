export interface AnimalMedia {
  animalId: string;
  src: string;
  alt: string;
  kind: "placeholder" | "photo";
  credit?: string;
}
export const animalMedia: Record<string, AnimalMedia> = {
  goat: {
    animalId: "goat",
    src: import.meta.env.BASE_URL + "illustrations/goat-placeholder.svg",
    alt: "ヤギの観察用イラスト。提供予定の写真に差し替えられます。",
    kind: "placeholder",
  },
};
