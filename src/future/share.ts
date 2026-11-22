import { drawingScene } from "../collection/drawingScene";
import { loadObservation, updateObservationImages } from "../notebook/storage";
import {
  claimReplicaShare,
  finishReplicaShare,
  loadPendingReplicaShares,
  loadReplicaRecord,
  migrateReplicaShareQueue,
} from "../replica/storage";
import { taskById } from "../content/tasks";
import type { ObservationRecord } from "../notebook/types";

// The study server supplies its own relay. Its pending sketches are kept apart
// from sketches submitted from users' ordinary sharing settings.
const CONFIG_KEY = "zooketch-share-v1";
export const automaticStudyShare =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_SHARE_CONSENT === "1";
export const managedProductionShare =
  import.meta.env.PROD &&
  import.meta.env.VITE_LEGACY_EDITIONS !== "1" &&
  typeof location !== "undefined" &&
  /^https?:$/.test(location.protocol);
const productionRelay = "__zooketch-share";
const QUEUE_KEY = automaticStudyShare
  ? "zooketch-study-share-queue-v1"
  : "zooketch-share-queue-v1";

function defaultConfig(): ShareConfig {
  return {
    consent: automaticStudyShare || managedProductionShare,
    endpoint: automaticStudyShare
      ? import.meta.env.BASE_URL + "__zooketch-test-share"
      : managedProductionShare
        ? (location.origin === "https://takuto-ando.github.io"
            ? "https://zooketch.pages.dev/"
            : import.meta.env.BASE_URL) + productionRelay
        : "",
    token: "",
  };
}

export type ShareConfig = {
  consent: boolean;
  endpoint: string;
  token: string;
};

export function loadShareConfig(): ShareConfig {
  if (automaticStudyShare) return defaultConfig();
  try {
    const raw = JSON.parse(
      localStorage.getItem(CONFIG_KEY) ?? "null",
    ) as Partial<ShareConfig> | null;
    const defaults = defaultConfig();
    return {
      consent:
        typeof raw?.consent === "boolean" ? raw.consent : defaults.consent,
      endpoint:
        !managedProductionShare && typeof raw?.endpoint === "string"
          ? raw.endpoint
          : defaults.endpoint,
      token:
        !managedProductionShare && typeof raw?.token === "string"
          ? raw.token
          : defaults.token,
    };
  } catch {
    return defaultConfig();
  }
}

export function saveShareConfig(config: ShareConfig) {
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify(
        managedProductionShare ? { consent: config.consent } : config,
      ),
    );
  } catch {
    // 保存できなくてもアプリは動き続ける
  }
}

type Queue = { sent: string[]; pending: string[] };

function isQueueId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function loadQueue(): Queue {
  try {
    const raw = JSON.parse(
      localStorage.getItem(QUEUE_KEY) ?? "null",
    ) as Partial<Queue> | null;
    return {
      sent: Array.isArray(raw?.sent)
        ? raw.sent.slice(-500).filter(isQueueId)
        : [],
      pending: Array.isArray(raw?.pending) ? raw.pending.filter(isQueueId) : [],
    };
  } catch {
    return { sent: [], pending: [] };
  }
}

function saveQueue(queue: Queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch {
    // 容量不足時は送信済み履歴だけ捨てる
    try {
      localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify({ sent: [], pending: queue.pending }),
      );
      return true;
    } catch {
      // それでも無理なら諦める（絵本体は端末に残る）
      return false;
    }
  }
}

export function pendingShareCount(): number {
  return loadQueue().pending.length;
}

export async function countPendingShares(): Promise<number> {
  const oldQueue = loadQueue();
  const pending = await loadPendingReplicaShares(QUEUE_KEY).catch(() => []);
  return new Set([...oldQueue.pending, ...pending.map(({ id }) => id)]).size;
}

/** Pass this into the sketch save so sending can resume after a reload. */
export function replicaShareDestination(): string | undefined {
  const { consent, endpoint } = loadShareConfig();
  return consent && endpoint ? QUEUE_KEY : undefined;
}

// The legacy notebook still uses its original separate pending list.
export function enqueueShare(recordId: string): void {
  const config = loadShareConfig();
  if (!config.consent || !config.endpoint) return;
  const queue = loadQueue();
  if (queue.sent.includes(recordId) || queue.pending.includes(recordId)) return;
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

export async function buildSharePayload(
  record: ObservationRecord,
  token = loadShareConfig().token,
) {
  let ownPng = record.ownPng;
  if (!ownPng) {
    const { composeObservationImages } = await import("../notebook/images");
    const scene = record.sceneSnapshot || drawingScene(record);
    const composed = await composeObservationImages(scene, record.strokes);
    ownPng = composed.ownPng;
    await updateObservationImages(record.id, composed).catch(() => undefined);
  }
  const strokesJson = JSON.stringify(record.strokes);
  return {
    token: token || undefined,
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

async function prepareShare(id: string, token: string) {
  if (!managedProductionShare) {
    const observation = await loadObservation(id).catch(() => undefined);
    if (observation) return buildSharePayload(observation, token);
  }
  return prepareReplicaShare(id, token);
}

async function prepareReplicaShare(id: string, token: string) {
  const record = await loadReplicaRecord(id);
  if (
    !record?.sketch ||
    !record.taskId ||
    !record.groupId ||
    !record.animalName
  )
    return;
  const match = /^data:image\/png;base64,([a-z0-9+/=]+)$/i.exec(record.sketch);
  if (!match) throw new Error("Invalid sketch PNG");
  return {
    token: token || undefined,
    id,
    createdAt: record.createdAt,
    animalName: record.animalName,
    taskName: taskById[record.taskId]?.part ?? record.taskId,
    groupId: record.groupId,
    pngBase64: match[1],
    strokes:
      JSON.stringify(record.strokes ?? []).length < 6_000_000
        ? record.strokes
        : undefined,
  };
}

let flushing = false;
let flushAgain = false;
let retryTimer: number | undefined;
let retryDeadline = Infinity;

function retryShareAt(time: number) {
  if (typeof window === "undefined" || time >= retryDeadline) return;
  clearTimeout(retryTimer);
  retryDeadline = time;
  retryTimer = window.setTimeout(
    () => {
      retryDeadline = Infinity;
      retryTimer = undefined;
      void flushShareQueue();
    },
    Math.max(100, time - Date.now()),
  );
}

async function deliverShare(
  payload: NonNullable<Awaited<ReturnType<typeof prepareShare>>>,
  active: ShareConfig,
): Promise<boolean> {
  const latest = loadShareConfig();
  if (
    !latest.consent ||
    latest.endpoint !== active.endpoint ||
    latest.token !== active.token ||
    !navigator.onLine
  )
    return false;

  // Managed relays acknowledge a confirmed Apps Script delivery with 204.
  const relay =
    (automaticStudyShare || managedProductionShare) &&
    active.endpoint === defaultConfig().endpoint;
  const abort = new AbortController();
  // Bound the request even when a captive portal or stalled relay never replies.
  const timeout = setTimeout(() => abort.abort(), 20_000);
  try {
    const response = await fetch(active.endpoint, {
      method: "POST",
      mode: relay
        ? new URL(active.endpoint, location.href).origin === location.origin
          ? "same-origin"
          : "cors"
        : "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    return relay
      ? response.status === 204
      : response.type === "opaque" || response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function flushReplicaShares(): Promise<number> {
  const queued = await loadPendingReplicaShares(QUEUE_KEY).catch(() => []);
  let sentNow = 0;
  for (const item of queued) {
    const active = loadShareConfig();
    if (!active.consent || !active.endpoint || !navigator.onLine) break;
    const now = Date.now();
    const nextSend = Math.max(item.retryAt, item.leaseUntil ?? 0);
    if (nextSend > now) {
      retryShareAt(nextSend);
      continue;
    }
    const claim = await claimReplicaShare(item.id, now).catch(() => undefined);
    if (!claim) {
      retryShareAt(now + 2_000);
      continue;
    }
    const payload = await prepareReplicaShare(item.id, active.token).catch(
      () => undefined,
    );
    const delivered = payload ? await deliverShare(payload, active) : false;
    if (delivered) sentNow++;
    const current = await finishReplicaShare(
      claim,
      delivered,
      Date.now(),
    ).catch(() => undefined);
    if (current?.state !== "sent")
      retryShareAt(current?.retryAt ?? claim.leaseUntil!);
    if (payload && !delivered) {
      // Resume the rest of the queue after any active transport failure.
      break;
    }
  }
  return sentNow;
}

async function migratePreviousReplicaQueue() {
  const { pending } = loadQueue();
  const adopted = new Set(
    await migrateReplicaShareQueue(QUEUE_KEY, pending).catch(() => []),
  );
  if (adopted.size) {
    const queue = loadQueue();
    saveQueue({
      sent: queue.sent,
      pending: queue.pending.filter((id) => !adopted.has(id)),
    });
  }
  return adopted;
}

async function flushPreviousQueue(
  adopted: ReadonlySet<string>,
): Promise<number> {
  let sentNow = 0;
  for (const id of loadQueue().pending) {
    if (adopted.has(id)) continue;
    const active = loadShareConfig();
    if (!active.consent || !active.endpoint || !navigator.onLine) break;
    const payload = await prepareShare(id, active.token).catch(() => undefined);
    if (!payload) continue;
    if (!(await deliverShare(payload, active))) {
      retryShareAt(Date.now() + 5_000);
      break;
    }
    sentNow++;
    // Re-read after sending so a sketch saved during the request stays queued.
    const queue = loadQueue();
    const pending = queue.pending.filter((item) => item !== id);
    const sent = queue.sent.includes(id) ? queue.sent : [...queue.sent, id];
    if (!saveQueue({ pending, sent })) break;
  }
  return sentNow;
}

export async function flushShareQueue(): Promise<number> {
  const config = loadShareConfig();
  if (!config.consent || !config.endpoint) return 0;
  if (typeof navigator === "undefined" || !navigator.onLine) return 0;
  if (flushing) {
    flushAgain = true;
    return 0;
  }
  flushing = true;
  clearTimeout(retryTimer);
  retryTimer = undefined;
  retryDeadline = Infinity;
  try {
    const adopted = await migratePreviousReplicaQueue();
    const durable = await flushReplicaShares();
    return durable + (await flushPreviousQueue(adopted));
  } finally {
    flushing = false;
    if (flushAgain) {
      flushAgain = false;
      queueMicrotask(() => void flushShareQueue());
    }
  }
}
