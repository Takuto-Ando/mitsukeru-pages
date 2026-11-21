import type { ReplicaRecord } from "./ReplicaGallery";

const DATABASE_NAME = "zooketch-figma-replica";
const STORE_NAME = "gallery";

// The app is designed for Kyoto City Zoo. This is a display label, not location data.
export const galleryPhotoLocation = "京都市動物園";

function openGallery(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("ギャラリーを開けませんでした。"));
  });
}

async function inGallery<T>(
  mode: IDBTransactionMode,
  access: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openGallery();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = access(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function loadReplicaRecords(): Promise<ReplicaRecord[]> {
  return inGallery("readonly", (gallery) => gallery.getAll());
}

export function loadReplicaRecord(
  id: string,
): Promise<ReplicaRecord | undefined> {
  return inGallery("readonly", (gallery) => gallery.get(id));
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

export function saveReplicaRecord(record: ReplicaRecord) {
  return inGallery("readwrite", (gallery) => gallery.put(record));
}

export function imageDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = new FileReader();
    file.onload = () => resolve(String(file.result));
    file.onerror = () => reject(file.error);
    file.readAsDataURL(blob);
  });
}
