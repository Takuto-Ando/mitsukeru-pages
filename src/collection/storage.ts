import { taskById } from "../content/tasks";
import { groups } from "../content/groups";
import type { Stroke } from "../types";

export const collectionKey = "mitsukeru.collection.v1";
export interface DrawingRecord {
  id: string;
  groupId: string;
  taskId?: string;
  sceneVersion?: 2;
  createdAt: string;
  strokes: Stroke[];
  outcome: "correct" | "self-confirmed";
}
export interface CollectionData {
  version: 1;
  drawings: DrawingRecord[];
}
export const emptyCollection = (): CollectionData => ({
  version: 1,
  drawings: [],
});
const maxRecords = 100;
const maxBytes = 3_000_000;

export function readCollection(
  storage: Pick<Storage, "getItem">,
): CollectionData {
  const raw = storage.getItem(collectionKey);
  if (!raw) return emptyCollection();
  const data = JSON.parse(raw) as CollectionData;
  if (
    data.version !== 1 ||
    !Array.isArray(data.drawings) ||
    data.drawings.length > maxRecords
  )
    throw new Error("保存データの形式を確認できませんでした。");
  const ids = new Set<string>();
  for (const d of data.drawings) {
    if (
      !d ||
      typeof d.id !== "string" ||
      ids.has(d.id) ||
      !groups.some((g) => g.id === d.groupId) ||
      (d.taskId !== undefined && taskById[d.taskId]?.groupId !== d.groupId) ||
      !Number.isFinite(Date.parse(d.createdAt)) ||
      (d.sceneVersion !== undefined && d.sceneVersion !== 2) ||
      !["correct", "self-confirmed"].includes(d.outcome) ||
      !Array.isArray(d.strokes) ||
      !d.strokes.length ||
      d.strokes.some(
        (s) =>
          !Array.isArray(s) ||
          s.length < 2 ||
          s.some(
            (p) =>
              !p ||
              !Number.isFinite(p.x) ||
              !Number.isFinite(p.y) ||
              p.x < 0 ||
              p.x > 600 ||
              p.y < 0 ||
              p.y > (d.sceneVersion === 2 ? 600 : 400),
          ),
      )
    )
      throw new Error("保存データの形式を確認できませんでした。");
    ids.add(d.id);
  }
  return data;
}

export function writeCollection(
  storage: Pick<Storage, "setItem">,
  data: CollectionData,
) {
  if (data.drawings.length > maxRecords)
    throw new Error("100枚まで保存できます。前の絵を削除すると追加できます。");
  const json = JSON.stringify(data);
  if (new Blob([json]).size > maxBytes)
    throw new Error("保存がいっぱいです。前の絵を削除すると追加できます。");
  // Commit before updating React state: failed/quota writes must not look saved.
  storage.setItem(collectionKey, json);
}
