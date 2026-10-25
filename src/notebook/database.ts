export const databaseName = "zooketch.observation-notebook";
let opening: Promise<IDBDatabase> | undefined;
export function database(): Promise<IDBDatabase> {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("observations", { keyPath: "id" });
        db.createObjectStore("researchEvents", { keyPath: "id" });
        db.createObjectStore("settings", { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = undefined;
        };
        resolve(db);
      };
      request.onerror = () =>
        reject(request.error || new Error("保存領域を開けませんでした。"));
      request.onblocked = () =>
        reject(new Error("別のタブを閉じて、保存をもう一度試してください。"));
    }).catch((error) => {
      opening = undefined;
      throw error;
    });
  return opening;
}
export const requestValue = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || new Error("保存処理を完了できませんでした。"));
    tx.onerror = () =>
      reject(tx.error || new Error("保存領域を確認してください。"));
  });
export async function getAll<T>(store: string): Promise<T[]> {
  const db = await database(),
    tx = db.transaction(store, "readonly");
  const done = transactionDone(tx);
  const rows = await requestValue<T[]>(tx.objectStore(store).getAll());
  await done;
  return rows;
}
export async function putValue(store: string, value: unknown) {
  const db = await database(),
    tx = db.transaction(store, "readwrite");
  const done = transactionDone(tx);
  tx.objectStore(store).put(value);
  await done;
}
