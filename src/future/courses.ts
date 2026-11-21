import type { ObservationRecord } from "../notebook/types";

// 観察コース：部位テーマごとに動物を順番に巡る連続ミッション。
export type Course = {
  id: string;
  title: string;
  description: string;
  groupIds: string[];
};

export const COURSES: Course[] = [
  {
    id: "eyes",
    title: "目をめぐるコース",
    description: "目の形と模様を比べながら進もう",
    groupIds: ["lemur", "goat", "meerkat", "fennec"],
  },
  {
    id: "noses",
    title: "鼻と顔のコース",
    description: "鼻の名人たちを順番に観察",
    groupIds: ["elephant", "tapir", "hippo", "mandrill"],
  },
  {
    id: "patterns",
    title: "模様を集めるコース",
    description: "体の模様を描き分ける旅",
    groupIds: ["zebra", "badger", "deer", "bear"],
  },
];

export function courseProgress(
  course: Course,
  drawings: ObservationRecord[],
): { doneIds: string[]; nextId: string | null; complete: boolean } {
  const observed = new Set(drawings.map((d) => d.groupId));
  const doneIds = course.groupIds.filter((id) => observed.has(id));
  const nextId = course.groupIds.find((id) => !observed.has(id)) ?? null;
  return { doneIds, nextId, complete: nextId === null };
}
