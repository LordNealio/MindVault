const DB_NAME = "workwrite_v1";
const DB_VERSION = 1;
let _db = null;

export const openDB = () =>
  new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("situations")) {
        const s = d.createObjectStore("situations", { keyPath: "id" });
        s.createIndex("date", "date");
        s.createIndex("status", "status");
      }
      if (!d.objectStoreNames.contains("checkins")) {
        const c = d.createObjectStore("checkins", { keyPath: "id" });
        c.createIndex("date", "date");
        c.createIndex("type", "type");
      }
      if (!d.objectStoreNames.contains("transcripts")) {
        const t = d.createObjectStore("transcripts", { keyPath: "id" });
        t.createIndex("date", "date");
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });

export const dbPut = async (store, item) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(item).onsuccess = (e) => resolve(e.target.result);
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const dbGet = async (store, key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    tx.objectStore(store).get(key).onsuccess = (e) => resolve(e.target.result);
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const dbGetAll = async (store) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    tx.objectStore(store).getAll().onsuccess = (e) => resolve(e.target.result || []);
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const dbGetByIndex = async (store, index, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    tx.objectStore(store).index(index).getAll(value).onsuccess = (e) =>
      resolve(e.target.result || []);
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const dbDelete = async (store, key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key).onsuccess = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
};
