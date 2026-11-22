import type { ReplicaRecord } from "./ReplicaGallery";

const DATABASE_NAME = "zooketch-figma-replica";
const STORE_NAME = "gallery";
const SHARE_STORE = "shareOutbox";
const SHARE_STATE_INDEX = "queueState";

export type ReplicaShare = {
  id: string;
  queue: string;
  state: "pending" | "sent";
  retryAt: number;
  attempts: number;
  leaseUntil?: number;
};

const shareLeaseMs = 40_000;
const pendingShare = (id: string, queue: string): ReplicaShare => ({
  id,
  queue,
  state: "pending",
  retryAt: 0,
  attempts: 0,
});

// The app is designed for Kyoto City Zoo. This is a display label, not location data.
export const galleryPhotoLocation = "京都市動物園";

function openGallery(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME))
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!database.objectStoreNames.contains(SHARE_STORE))
        database
          .createObjectStore(SHARE_STORE, { keyPath: "id" })
          .createIndex(SHARE_STATE_INDEX, ["queue", "state"]);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("ギャラリーを開けませんでした。"));
    };
  });
}

async function inStore<T>(
  name: string,
  mode: IDBTransactionMode,
  access: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openGallery();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(name, mode);
      const request = access(transaction.objectStore(name));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function loadReplicaRecords(): Promise<ReplicaRecord[]> {
  return inStore(STORE_NAME, "readonly", (gallery) => gallery.getAll());
}

export function loadReplicaRecord(
  id: string,
): Promise<ReplicaRecord | undefined> {
  return inStore(STORE_NAME, "readonly", (gallery) => gallery.get(id));
}

/** Update metadata without recreating a failed capture or overwriting its photo. */
export async function identifyReplicaPhoto(
  id: string,
  details: Pick<
    ReplicaRecord,
    "groupId" | "taskId" | "animalName" | "photoDescription"
  >,
): Promise<ReplicaRecord | undefined> {
  const database = await openGallery();
  try {
    return await new Promise<ReplicaRecord | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const gallery = transaction.objectStore(STORE_NAME);
      const request = gallery.get(id);
      let updated: ReplicaRecord | undefined;
      request.onsuccess = () => {
        const record = request.result as ReplicaRecord | undefined;
        if (!record?.photo) return;
        updated = { ...record, ...details };
        gallery.put(updated);
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveReplicaRecord(
  record: ReplicaRecord,
  shareQueue?: string,
) {
  if (!shareQueue)
    return inStore(STORE_NAME, "readwrite", (gallery) => gallery.put(record));

  const database = await openGallery();
  try {
    return await new Promise<IDBValidKey>((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAME, SHARE_STORE],
        "readwrite",
      );
      const request = transaction.objectStore(STORE_NAME).put(record);
      const outbox = transaction.objectStore(SHARE_STORE);
      const lookup = outbox.get(record.id);
      lookup.onsuccess = () => {
        if (lookup.result) return;
        // The sketch and its send marker commit together, even offline.
        try {
          outbox.put(pendingShare(record.id, shareQueue));
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Adopt old product queue entries without loading their full images. */
export async function migrateReplicaShareQueue(
  queue: string,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  const database = await openGallery();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAME, SHARE_STORE],
        "readwrite",
      );
      const gallery = transaction.objectStore(STORE_NAME);
      const outbox = transaction.objectStore(SHARE_STORE);
      const adopted: string[] = [];
      for (const id of new Set(ids)) {
        const capture = gallery.getKey(id);
        capture.onsuccess = () => {
          if (!capture.result) return;
          const existing = outbox.getKey(id);
          existing.onsuccess = () => {
            try {
              if (!existing.result) outbox.put(pendingShare(id, queue));
              adopted.push(id);
            } catch (error) {
              transaction.abort();
              reject(error);
            }
          };
        };
      }
      transaction.oncomplete = () => resolve(adopted);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function loadPendingReplicaShares(queue: string) {
  return inStore<ReplicaShare[]>(SHARE_STORE, "readonly", (outbox) =>
    outbox.index(SHARE_STATE_INDEX).getAll([queue, "pending"]),
  );
}

function updateReplicaShare(
  id: string,
  update: (share: ReplicaShare) => ReplicaShare | undefined,
): Promise<ReplicaShare | undefined> {
  return openGallery().then(async (database) => {
    try {
      return await new Promise<ReplicaShare | undefined>((resolve, reject) => {
        const transaction = database.transaction(SHARE_STORE, "readwrite");
        const outbox = transaction.objectStore(SHARE_STORE);
        const request = outbox.get(id);
        let next: ReplicaShare | undefined;
        request.onsuccess = () => {
          try {
            if (request.result) next = update(request.result as ReplicaShare);
            if (next) outbox.put(next);
          } catch (error) {
            transaction.abort();
            reject(error);
          }
        };
        transaction.oncomplete = () => resolve(next);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });
}

/** Serialize overlapping attempts across tabs, recovering if a tab is closed. */
export function claimReplicaShare(id: string, now: number) {
  return updateReplicaShare(id, (share) =>
    share.state === "pending" &&
    Math.max(share.retryAt, share.leaseUntil ?? 0) <= now
      ? { ...share, leaseUntil: now + shareLeaseMs }
      : undefined,
  );
}

export function finishReplicaShare(
  claim: ReplicaShare,
  sent: boolean,
  now: number,
) {
  return updateReplicaShare(claim.id, (share) => {
    if (share.leaseUntil !== claim.leaseUntil || share.state !== "pending")
      return;
    const attempts = share.attempts + 1;
    const delay = Math.min(60_000, 2_000 * 2 ** Math.min(attempts - 1, 5));
    return {
      ...share,
      state: sent ? "sent" : "pending",
      retryAt: sent ? 0 : now + delay,
      attempts,
      leaseUntil: undefined,
    };
  });
}

export function imageDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = new FileReader();
    file.onload = () => resolve(String(file.result));
    file.onerror = () => reject(file.error);
    file.readAsDataURL(blob);
  });
}
