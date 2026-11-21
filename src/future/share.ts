import { drawingScene } from "../collection/drawingScene";
import { composeObservationImages } from "../notebook/images";
import {
  loadObservations,
  updateObservationImages,
} from "../notebook/storage";
import type { ObservationRecord } from "../notebook/types";

// お客さんの絵を研究用に自動送信する仕組み（Google Apps Script 経由で
// Googleドライブへ集める）。既定はOFF。保護者の同意（設定でON）にした
// 端末からだけ、保存のたびにキューへ入り、オンライン時に送信される。
const CONFIG_KEY = "zooketch-share-v1";
const QUEUE_KEY = "zooketch-share-queue-v1";

export type ShareConfig = {
  consent: boolean;
  endpoint: string;
  token: string;
};

export function loadShareConfig(): ShareConfig {
  try {
    const raw = JSON.parse(
      localStorage.getItem(CONFIG_KEY) ?? "null",
    ) as Partial<ShareConfig> | null;
    return {
      consent: raw?.consent === true,
      endpoint: typeof raw?.endpoint === "string" ? raw.endpoint : "",
      token: typeof raw?.token === "string" ? raw.token : "",
    };
  } catch {
    return { consent: false, endpoint: "", token: "" };
  }
}

export function saveShareConfig(config: ShareConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // 保存できなくてもアプリは動き続ける
  }
}

type Queue = { sent: string[]; pending: string[] };

function loadQueue(): Queue {
  try {
    const raw = JSON.parse(
      localStorage.getItem(QUEUE_KEY) ?? "null",
    ) as Partial<Queue> | null;
    return {
      sent: Array.isArray(raw?.sent) ? raw.sent.slice(-500) : [],
      pending: Array.isArray(raw?.pending) ? raw.pending : [],
    };
  } catch {
    return { sent: [], pending: [] };
  }
}

function saveQueue(queue: Queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // 容量不足時は送信済み履歴だけ捨てる
    try {
      localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify({ sent: [], pending: queue.pending }),
      );
    } catch {
      // それでも無理なら諦める（絵本体は端末に残る）
    }
  }
}

export function pendingShareCount(): number {
  return loadQueue().pending.length;
}

export function enqueueShare(recordId: string): void {
  const config = loadShareConfig();
  if (!config.consent || !config.endpoint) return;
  const queue = loadQueue();
  if (queue.sent.includes(recordId) || queue.pending.includes(recordId))
    return;
  queue.pending.push(recordId);
  saveQueue(queue);
  void flushShareQueue();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export async function buildSharePayload(record: ObservationRecord) {
  const config = loadShareConfig();
  let ownPng = record.ownPng;
  if (!ownPng) {
    const scene = record.sceneSnapshot || drawingScene(record);
    const composed = await composeObservationImages(scene, record.strokes);
    ownPng = composed.ownPng;
    await updateObservationImages(record.id, composed).catch(
      () => undefined,
    );
  }
  const strokesJson = JSON.stringify(record.strokes);
  return {
    token: config.token,
    id: record.id,
    createdAt: record.createdAt,
    animalName: record.animalName,
    taskName: record.taskName,
    groupId: record.groupId,
    profileId: record.profileId ?? "",
    discovery: record.discovery ?? "",
    pngBase64: await blobToBase64(ownPng),
    // 線データは復元用。大きすぎる場合は絵だけ送る
    strokes: strokesJson.length < 6_000_000 ? record.strokes : undefined,
  };
}

let flushing = false;

export async function flushShareQueue(): Promise<number> {
  const config = loadShareConfig();
  if (!config.consent || !config.endpoint || flushing) return 0;
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  flushing = true;
  let sentNow = 0;
  try {
    const queue = loadQueue();
    if (!queue.pending.length) return 0;
    const records = await loadObservations();
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const id of [...queue.pending]) {
      const record = byId.get(id);
      if (!record) {
        queue.pending = queue.pending.filter((p) => p !== id);
        continue;
      }
      try {
        const payload = await buildSharePayload(record);
        // GASはCORSヘッダーを返さないため no-cors で送る（応答は読めない）。
        // サーバー側で記録IDの重複を弾くので、再送しても二重登録にならない。
        await fetch(config.endpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        queue.pending = queue.pending.filter((p) => p !== id);
        queue.sent.push(id);
        sentNow++;
        saveQueue(queue);
      } catch {
        break; // 通信失敗時は残りをキューに残して次回に回す
      }
    }
    saveQueue(queue);
    return sentNow;
  } catch {
    return sentNow; // 保存領域に触れない環境では静かに諦める
  } finally {
    flushing = false;
  }
}
