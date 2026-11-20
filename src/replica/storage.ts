import type { ReplicaRecord } from "./ReplicaGallery";

const DATABASE_NAME = "zooketch-figma-replica";
const STORE_NAME = "gallery";

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

export async function loadReplicaRecords(): Promise<ReplicaRecord[]> {
  return (await inGallery("readonly", (gallery) =>
    gallery.getAll(),
  )) as ReplicaRecord[];
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
