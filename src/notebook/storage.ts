import { database, getAll, requestValue, transactionDone } from "./database";
import { readCollection } from "../collection/storage";
import { drawingScene } from "../collection/drawingScene";
import { taskById } from "../content/tasks";
import { groups } from "../content/groups";
import type { DrawingRecord } from "../collection/storage";
import type { ObservationRecord } from "./types";

const imageKeys = ["ownPng", "answerPng", "comparisonPng"] as const;

async function toStorable<T extends Partial<ObservationRecord>>(record: T) {
  const copy: Record<string, unknown> = { ...record };
  for (const key of imageKeys) {
    const val = record[key];
    if (val instanceof Blob) {
      copy[key] = new Uint8Array(await val.arrayBuffer());
    }
  }
  return copy;
}

function fromStorable(raw: ObservationRecord): ObservationRecord {
  const copy = { ...raw };
  for (const key of imageKeys) {
    const val = copy[key] as unknown;
    if (val instanceof Uint8Array || val instanceof ArrayBuffer) {
      copy[key] = new Blob([val as BlobPart], { type: "image/png" });
    }
  }
  return copy;
}

export function observationMetadata(record: DrawingRecord): ObservationRecord {
  const task = taskById[record.taskId || record.groupId];
  return {
    ...record,
    taskId: task.id,
    animalName: groups.find((g) => g.id === record.groupId)!.name,
    taskName: task.part,
    explanation: structuredClone(task.explanation),
    question: task.next,
    sceneSnapshot: structuredClone(drawingScene(record)),
  };
}

// One atomic migration, tracked in IndexedDB. The original localStorage is a backup;
// deleting a migrated note never resurrects it on the next reload.
export async function initializeNotebook(): Promise<ObservationRecord[]> {
  const db = await database();
  const check = db.transaction("settings", "readonly");
  const checkDone = transactionDone(check);
  const migrated = await requestValue(
    check.objectStore("settings").get("legacy-migrated"),
  );
  await checkDone;
  if (!migrated) {
    let old: DrawingRecord[] = [];
    // Do not overwrite corrupt/unsupported source data. Let the user retry after repair.
    old = readCollection(localStorage).drawings;
    const tx = db.transaction(["observations", "settings"], "readwrite"),
      done = transactionDone(tx);
    const marker = tx.objectStore("settings").get("legacy-migrated");
    marker.onsuccess = () => {
      if (marker.result) return;
      for (const record of old) {
        const req = tx.objectStore("observations").get(record.id);
        req.onsuccess = () => {
          if (!req.result)
            tx.objectStore("observations").put({
              ...observationMetadata(record),
              migrated: true,
            });
        };
      }
      tx.objectStore("settings").put({
        id: "legacy-migrated",
        at: new Date().toISOString(),
      });
    };
    await done;
  }
  return loadObservations();
}

export async function loadObservations() {
  return (await getAll<ObservationRecord>("observations"))
    .map(fromStorable)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addObservation(record: ObservationRecord) {
  const storable = await toStorable(record);
  const db = await database(),
    tx = db.transaction("observations", "readwrite"),
    done = transactionDone(tx);
  tx.objectStore("observations").add(storable);
  await done;
}

export async function deleteObservation(id: string) {
  const db = await database(),
    tx = db.transaction("observations", "readwrite"),
    done = transactionDone(tx);
  tx.objectStore("observations").delete(id);
  await done;
}

export async function updateObservationImages(
  id: string,
  images: Pick<ObservationRecord, "ownPng" | "answerPng" | "comparisonPng">,
) {
  const storable = await toStorable(images);
  const db = await database(),
    tx = db.transaction("observations", "readwrite"),
    done = transactionDone(tx);
  const request = tx.objectStore("observations").get(id);
  request.onsuccess = () => {
    if (request.result)
      tx.objectStore("observations").put({ ...request.result, ...storable });
  };
  await done;
}
