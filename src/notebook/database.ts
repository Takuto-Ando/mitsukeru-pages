export const databaseName = "zooketch.observation-notebook";
let opening: Promise<IDBDatabase> | undefined;
let generation = 0;
export function database(): Promise<IDBDatabase> {
  if (!opening) {
    const token = ++generation;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("observations", { keyPath: "id" });
        db.createObjectStore("researchEvents", { keyPath: "id" });
        db.createObjectStore("settings", { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        // A blocked open can complete after the caller has already retried.
        if (blocked || token !== generation) {
          db.close();
          return;
        }
        const invalidate = () => {
          if (token === generation) opening = undefined;
        };
        db.onversionchange = () => {
          db.close();
          invalidate();
        };
        db.onclose = invalidate;
        resolve(db);
      };
      request.onerror = () =>
        reject(request.error || new Error("保存領域を開けませんでした。"));
      request.onblocked = () => {
        blocked = true;
        reject(new Error("別のタブを閉じて、保存をもう一度試してください。"));
      };
    }).catch((error) => {
      if (token === generation) opening = undefined;
      throw error;
    });
  }
  return opening;
}
export const requestValue = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export const transactionDone = (tx: IDBTransaction) => {
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || new Error("保存処理を完了できませんでした。"));
    tx.onerror = () =>
      reject(tx.error || new Error("保存領域を確認してください。"));
  });
  // Callers may first await an individual request, which can reject before they
  // reach this promise. Keep that failure handled while preserving rejection.
  void done.catch(() => {});
  return done;
};
export async function getAll<T>(store: string): Promise<T[]> {
  const db = await database(),
    tx = db.transaction(store, "readonly");
  const done = transactionDone(tx);
  const [rows] = await Promise.all([
    requestValue<T[]>(tx.objectStore(store).getAll()),
    done,
  ]);
  return rows;
}
export async function putValue(store: string, value: unknown) {
  const db = await database(),
    tx = db.transaction(store, "readwrite");
  const done = transactionDone(tx);
  tx.objectStore(store).put(value);
  await done;
}
